import { z } from "zod";
import { and, asc, eq, gt, ilike, lt, lte, gte, or, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { addDaysISO, badRequest, body, notFound, route, searchParam, todayISO } from "@/lib/server/api";
import { getSettings } from "@/lib/server/settings";

const b = schema.batches;

export const GET = route(async ({ req, db }) => {
  const filter = searchParam(req, "filter"); // all | expiring | expired | instock
  const q = searchParam(req, "q");
  const settings = await getSettings(db);
  const today = todayISO();

  const where: SQL[] = [];
  if (filter === "expired") where.push(lt(b.expiryDate, today), gt(b.quantity, 0));
  else if (filter === "expiring")
    where.push(gte(b.expiryDate, today), lte(b.expiryDate, addDaysISO(settings.expiryAlertDays)), gt(b.quantity, 0));
  else if (filter !== "all") where.push(gt(b.quantity, 0));
  if (q) {
    const like = `%${q}%`;
    where.push(or(ilike(schema.products.name, like), ilike(b.batchNumber, like), ilike(schema.products.genericName, like))!);
  }

  return db
    .select({
      id: b.id,
      productId: b.productId,
      productName: schema.products.name,
      strength: schema.products.strength,
      dosageForm: schema.products.dosageForm,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      initialQuantity: b.initialQuantity,
      costPrice: b.costPrice,
      sellPrice: schema.products.sellPrice,
      supplierName: schema.suppliers.name,
      receivedAt: b.receivedAt,
    })
    .from(b)
    .innerJoin(schema.products, eq(b.productId, schema.products.id))
    .leftJoin(schema.suppliers, eq(b.supplierId, schema.suppliers.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(b.expiryDate), asc(schema.products.name))
    .limit(1000);
});

const Receive = z.object({
  productId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid expiry date"),
  quantity: z.number().int().positive(),
  costPrice: z.number().min(0).optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  note: z.string().default(""),
});

/** Receive stock directly (without a purchase order). */
export const POST = route(
  async ({ req, db, user }) => {
    const input = await body(req, Receive);
    if (input.expiryDate < todayISO()) throw badRequest("You cannot receive an expired batch");
    return db.transaction(async (tx) => {
      const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, input.productId));
      if (!product) throw notFound("Product");
      const costPrice = input.costPrice ?? product.costPrice;
      const [batch] = await tx
        .insert(b)
        .values({
          productId: input.productId,
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          initialQuantity: input.quantity,
          costPrice,
          supplierId: input.supplierId ?? null,
        })
        .returning();
      if (input.costPrice !== undefined) {
        await tx.update(schema.products).set({ costPrice }).where(eq(schema.products.id, product.id));
      }
      await tx.insert(schema.stockMovements).values({
        productId: product.id,
        batchId: batch.id,
        type: "purchase",
        quantity: input.quantity,
        reference: batch.batchNumber,
        note: input.note || "Stock received",
        userId: user.id,
      });
      return batch;
    });
  },
  { roles: ["admin", "pharmacist"] },
);
