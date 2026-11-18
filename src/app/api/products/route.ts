import { z } from "zod";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, route, searchParam } from "@/lib/server/api";
import { ProductInput } from "@/lib/server/validation";
import { productListColumns, stockSql, expiredStockSql, nextExpirySql } from "@/lib/server/inventory";
import { getSettings } from "@/lib/server/settings";

const p = schema.products;

export const GET = route(async ({ req, db }) => {
  const q = searchParam(req, "q");
  const categoryId = Number(searchParam(req, "categoryId")) || 0;
  const status = searchParam(req, "status"); // active | inactive | low | out | expiring | expired | all
  const limit = Math.min(Number(searchParam(req, "limit")) || 500, 1000);
  const settings = await getSettings(db);

  const where: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    where.push(
      or(
        ilike(p.name, like),
        ilike(p.genericName, like),
        ilike(p.brand, like),
        ilike(p.sku, like),
        eq(p.barcode, q),
        ilike(p.manufacturer, like),
      )!,
    );
  }
  if (categoryId) where.push(eq(p.categoryId, categoryId));
  if (status === "inactive") where.push(eq(p.active, false));
  else if (status !== "all") where.push(eq(p.active, true));
  if (status === "low") where.push(sql`${stockSql} > 0 and ${stockSql} <= greatest(${p.reorderLevel}, 0)`);
  if (status === "out") where.push(sql`${stockSql} = 0`);
  if (status === "expired") where.push(sql`${expiredStockSql} > 0`);
  if (status === "expiring")
    where.push(sql`${nextExpirySql} <= (current_date + ${settings.expiryAlertDays}::int)::text`);

  return db
    .select(productListColumns)
    .from(p)
    .leftJoin(schema.categories, eq(p.categoryId, schema.categories.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      q ? sql`case when ${p.barcode} = ${q} then 0 when ${p.name} ilike ${q + "%"} then 1 else 2 end` : asc(p.name),
      asc(p.name),
    )
    .limit(limit);
});

const Create = ProductInput.extend({
  openingStock: z
    .object({
      batchNumber: z.string().trim().min(1),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      quantity: z.number().int().positive(),
    })
    .nullable()
    .optional(),
});

export const POST = route(
  async ({ req, db, user }) => {
    const { openingStock, ...input } = await body(req, Create);
    if (input.controlled) input.requiresPrescription = true;
    return db.transaction(async (tx) => {
      const [product] = await tx.insert(p).values(input).returning();
      if (!product.sku) {
        const sku = `MED-${String(product.id).padStart(5, "0")}`;
        await tx.update(p).set({ sku }).where(eq(p.id, product.id));
        product.sku = sku;
      }
      if (openingStock) {
        if (openingStock.expiryDate < new Date().toISOString().slice(0, 10)) {
          throw badRequest("Opening stock is already expired");
        }
        const [batch] = await tx
          .insert(schema.batches)
          .values({
            productId: product.id,
            batchNumber: openingStock.batchNumber,
            expiryDate: openingStock.expiryDate,
            quantity: openingStock.quantity,
            initialQuantity: openingStock.quantity,
            costPrice: input.costPrice,
          })
          .returning();
        await tx.insert(schema.stockMovements).values({
          productId: product.id,
          batchId: batch.id,
          type: "opening",
          quantity: openingStock.quantity,
          reference: batch.batchNumber,
          note: "Opening stock",
          userId: user.id,
        });
      }
      return product;
    });
  },
  { roles: ["admin", "pharmacist"] },
);
