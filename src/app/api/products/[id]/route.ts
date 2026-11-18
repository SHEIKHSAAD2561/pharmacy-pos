import { asc, desc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { body, idParam, notFound, route } from "@/lib/server/api";
import { productListColumns } from "@/lib/server/inventory";
import { ProductInput } from "@/lib/server/validation";

const p = schema.products;

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const id = idParam(params.id);
  const [product] = await db
    .select(productListColumns)
    .from(p)
    .leftJoin(schema.categories, eq(p.categoryId, schema.categories.id))
    .where(eq(p.id, id));
  if (!product) throw notFound("Product");

  const batches = await db
    .select({
      id: schema.batches.id,
      batchNumber: schema.batches.batchNumber,
      expiryDate: schema.batches.expiryDate,
      quantity: schema.batches.quantity,
      initialQuantity: schema.batches.initialQuantity,
      costPrice: schema.batches.costPrice,
      receivedAt: schema.batches.receivedAt,
      supplierName: schema.suppliers.name,
    })
    .from(schema.batches)
    .leftJoin(schema.suppliers, eq(schema.batches.supplierId, schema.suppliers.id))
    .where(eq(schema.batches.productId, id))
    .orderBy(asc(schema.batches.expiryDate));

  const movements = await db
    .select({
      id: schema.stockMovements.id,
      type: schema.stockMovements.type,
      quantity: schema.stockMovements.quantity,
      reference: schema.stockMovements.reference,
      note: schema.stockMovements.note,
      createdAt: schema.stockMovements.createdAt,
      userName: schema.users.name,
    })
    .from(schema.stockMovements)
    .leftJoin(schema.users, eq(schema.stockMovements.userId, schema.users.id))
    .where(eq(schema.stockMovements.productId, id))
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(50);

  return { ...product, batches, movements };
});

export const PUT = route<{ id: string }>(
  async ({ req, db, params }) => {
    const input = await body(req, ProductInput.partial());
    if (input.controlled) input.requiresPrescription = true;
    const [row] = await db.update(p).set(input).where(eq(p.id, idParam(params.id))).returning();
    if (!row) throw notFound("Product");
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);

export const DELETE = route<{ id: string }>(
  async ({ db, params }) => {
    const id = idParam(params.id);
    try {
      await db.delete(p).where(eq(p.id, id));
      return { deleted: true };
    } catch {
      // Product has sales history: keep it for records, hide it from the catalog.
      await db.update(p).set({ active: false }).where(eq(p.id, id));
      return { deleted: false, deactivated: true };
    }
  },
  { roles: ["admin"] },
);
