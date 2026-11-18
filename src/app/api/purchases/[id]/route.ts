import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, idParam, notFound, route } from "@/lib/server/api";

const po = schema.purchaseOrders;

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const id = idParam(params.id);
  const [row] = await db
    .select({ po, supplier: schema.suppliers, createdByName: schema.users.name })
    .from(po)
    .innerJoin(schema.suppliers, eq(po.supplierId, schema.suppliers.id))
    .leftJoin(schema.users, eq(po.createdBy, schema.users.id))
    .where(eq(po.id, id));
  if (!row) throw notFound("Purchase order");
  const items = await db
    .select({
      id: schema.purchaseOrderItems.id,
      productId: schema.purchaseOrderItems.productId,
      quantity: schema.purchaseOrderItems.quantity,
      costPrice: schema.purchaseOrderItems.costPrice,
      receivedQty: schema.purchaseOrderItems.receivedQty,
      productName: schema.products.name,
      strength: schema.products.strength,
      dosageForm: schema.products.dosageForm,
      sku: schema.products.sku,
    })
    .from(schema.purchaseOrderItems)
    .innerJoin(schema.products, eq(schema.purchaseOrderItems.productId, schema.products.id))
    .where(eq(schema.purchaseOrderItems.purchaseOrderId, id))
    .orderBy(asc(schema.purchaseOrderItems.id));
  return { ...row.po, supplier: row.supplier, createdByName: row.createdByName, items };
});

const Patch = z.object({ status: z.enum(["ordered", "cancelled"]) });

export const PATCH = route<{ id: string }>(
  async ({ req, db, params }) => {
    const { status } = await body(req, Patch);
    const id = idParam(params.id);
    const [current] = await db.select().from(po).where(eq(po.id, id));
    if (!current) throw notFound("Purchase order");
    if (["received", "cancelled"].includes(current.status)) {
      throw badRequest(`This order is already ${current.status}`);
    }
    if (status === "cancelled" && current.status === "partially_received") {
      throw badRequest("A partially received order cannot be cancelled");
    }
    const [row] = await db.update(po).set({ status }).where(eq(po.id, id)).returning();
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);

export const DELETE = route<{ id: string }>(
  async ({ db, params }) => {
    const id = idParam(params.id);
    const [current] = await db.select().from(po).where(eq(po.id, id));
    if (!current) throw notFound("Purchase order");
    if (current.status !== "draft") throw badRequest("Only draft orders can be deleted");
    await db.delete(po).where(eq(po.id, id));
    return { ok: true };
  },
  { roles: ["admin", "pharmacist"] },
);
