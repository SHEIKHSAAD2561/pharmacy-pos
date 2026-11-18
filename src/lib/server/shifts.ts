import "server-only";
import { sql } from "drizzle-orm";
import type { DB, Tx } from "@/db";

export type ShiftSummary = {
  salesCount: number;
  salesTotal: number;
  cashSales: number;
  cardSales: number;
  otherSales: number;
  cashRefunds: number;
  expectedCash: number;
};

export async function shiftSummary(
  db: DB | Tx,
  shift: { id: number; userId: number; openedAt: Date; closedAt: Date | null; openingCash: number },
): Promise<ShiftSummary> {
  const until = shift.closedAt ?? new Date();
  const result = await db.execute(sql`
    select
      count(*)::int as sales_count,
      coalesce(sum(amount_due), 0)::float8 as sales_total,
      coalesce(sum(cash_amount - change_given), 0)::float8 as cash_sales,
      coalesce(sum(card_amount), 0)::float8 as card_sales,
      coalesce(sum(other_amount), 0)::float8 as other_sales,
      (select coalesce(sum(r.refund_amount), 0)::float8 from returns r
        where r.user_id = ${shift.userId} and r.refund_method = 'cash'
        and r.created_at >= ${shift.openedAt.toISOString()}::timestamptz and r.created_at <= ${until.toISOString()}::timestamptz) as cash_refunds
    from sales where shift_id = ${shift.id}
  `);
  const rows = rowsOf<Record<string, number>>(result);
  const r = rows[0] ?? {};
  const cashSales = Number(r.cash_sales) || 0;
  const cashRefunds = Number(r.cash_refunds) || 0;
  return {
    salesCount: Number(r.sales_count) || 0,
    salesTotal: Number(r.sales_total) || 0,
    cashSales,
    cardSales: Number(r.card_sales) || 0,
    otherSales: Number(r.other_sales) || 0,
    cashRefunds,
    expectedCash: Math.round((shift.openingCash + cashSales - cashRefunds) * 100) / 100,
  };
}

/** Normalizes db.execute() results across postgres-js (array) and PGlite ({ rows }). */
export function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}
