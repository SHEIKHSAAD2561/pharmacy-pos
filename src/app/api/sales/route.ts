import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { body, route, searchParam } from "@/lib/server/api";
import { createSale, SaleInput } from "@/lib/server/sales";
import { getSettings } from "@/lib/server/settings";

const s = schema.sales;

export const GET = route(async ({ req, db }) => {
  const q = searchParam(req, "q");
  const from = searchParam(req, "from");
  const to = searchParam(req, "to");
  const status = searchParam(req, "status");
  const payment = searchParam(req, "payment");
  const limit = Math.min(Number(searchParam(req, "limit")) || 300, 1000);

  const settings = await getSettings(db);
  const tz = settings.timezone || "UTC";
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  const where: SQL[] = [];
  if (isDate(from)) where.push(sql`(${s.createdAt} at time zone ${tz})::date >= ${from}::date`);
  if (isDate(to)) where.push(sql`(${s.createdAt} at time zone ${tz})::date <= ${to}::date`);
  if (status) where.push(eq(s.status, status as (typeof s.status.enumValues)[number]));
  if (payment) where.push(eq(s.paymentMethod, payment));
  if (q) where.push(or(ilike(s.invoiceNo, `%${q}%`), ilike(schema.customers.name, `%${q}%`), ilike(schema.customers.phone, `%${q}%`))!);

  return db
    .select({
      id: s.id,
      invoiceNo: s.invoiceNo,
      customerName: schema.customers.name,
      cashierName: schema.users.name,
      subtotal: s.subtotal,
      discount: s.discount,
      tax: s.tax,
      total: s.total,
      insuranceAmount: s.insuranceAmount,
      amountDue: s.amountDue,
      refundedAmount: s.refundedAmount,
      paymentMethod: s.paymentMethod,
      status: s.status,
      createdAt: s.createdAt,
    })
    .from(s)
    .leftJoin(schema.customers, eq(s.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(s.userId, schema.users.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(s.createdAt), desc(s.id))
    .limit(limit);
});

export const POST = route(async ({ req, db, user }) => {
  const input = await body(req, SaleInput);
  return db.transaction(async (tx) => {
    const settings = await getSettings(tx);
    return createSale(tx, input, user, settings);
  });
});
