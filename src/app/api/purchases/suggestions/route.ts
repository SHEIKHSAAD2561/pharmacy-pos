import { and, asc, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import { route } from "@/lib/server/api";
import { stockSql } from "@/lib/server/inventory";

/** Products at or below their reorder level, with a suggested order quantity. */
export const GET = route(async ({ db }) => {
  const p = schema.products;
  const rows = await db
    .select({
      productId: p.id,
      name: p.name,
      strength: p.strength,
      dosageForm: p.dosageForm,
      costPrice: p.costPrice,
      reorderLevel: p.reorderLevel,
      stock: stockSql,
      lastSupplierId: sql<number | null>`(select b.supplier_id from batches b where b.product_id = "products"."id" and b.supplier_id is not null order by b.received_at desc limit 1)`,
    })
    .from(p)
    .where(and(eq(p.active, true), sql`${stockSql} <= ${p.reorderLevel}`))
    .orderBy(asc(p.name));
  return rows.map((r) => ({ ...r, suggestedQty: Math.max(r.reorderLevel * 2 - r.stock, r.reorderLevel, 1) }));
});
