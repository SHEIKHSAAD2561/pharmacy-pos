import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, idParam, notFound, route, todayISO } from "@/lib/server/api";

const Receive = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantity: z.number().int().min(0),
        batchNumber: z.string().trim(),
        expiryDate: z.string(),
        costPrice: z.number().min(0).optional(),
      }),
    )
    .min(1),
});

export const POST = route<{ id: string }>(
  async ({ req, db, user, params }) => {
    const input = await body(req, Receive);
    const id = idParam(params.id);
    return db.transaction(async (tx) => {
      const [order] = await tx.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, id)).for("update");
      if (!order) throw notFound("Purchase order");
      if (["received", "cancelled"].includes(order.status)) throw badRequest(`This order is already ${order.status}`);

      const lines = await tx
        .select()
        .from(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.purchaseOrderId, id));
      const byId = new Map(lines.map((l) => [l.id, l]));
      let receivedAny = false;

      for (const r of input.items) {
        if (r.quantity === 0) continue;
        const line = byId.get(r.itemId);
        if (!line) throw badRequest("Item does not belong to this order");
        if (!r.batchNumber) throw badRequest("Batch number is required for each received item");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate)) throw badRequest("Expiry date is required for each received item");
        if (r.expiryDate < todayISO()) throw badRequest(`Batch ${r.batchNumber} is already expired`);
        const outstanding = line.quantity - line.receivedQty;
        if (r.quantity > outstanding) throw badRequest(`Only ${outstanding} units are outstanding for one of the items`);

        const costPrice = r.costPrice ?? line.costPrice;
        const [batch] = await tx
          .insert(schema.batches)
          .values({
            productId: line.productId,
            batchNumber: r.batchNumber,
            expiryDate: r.expiryDate,
            quantity: r.quantity,
            initialQuantity: r.quantity,
            costPrice,
            supplierId: order.supplierId,
            purchaseOrderId: order.id,
          })
          .returning();
        await tx
          .update(schema.purchaseOrderItems)
          .set({ receivedQty: line.receivedQty + r.quantity })
          .where(eq(schema.purchaseOrderItems.id, line.id));
        line.receivedQty += r.quantity;
        await tx.update(schema.products).set({ costPrice }).where(eq(schema.products.id, line.productId));
        await tx.insert(schema.stockMovements).values({
          productId: line.productId,
          batchId: batch.id,
          type: "purchase",
          quantity: r.quantity,
          reference: order.poNumber,
          note: `Received batch ${r.batchNumber}`,
          userId: user.id,
        });
        receivedAny = true;
      }

      if (!receivedAny) throw badRequest("Enter a quantity for at least one item");
      const complete = lines.every((l) => l.receivedQty >= l.quantity);
      const [updated] = await tx
        .update(schema.purchaseOrders)
        .set({ status: complete ? "received" : "partially_received", receivedAt: complete ? new Date() : null })
        .where(eq(schema.purchaseOrders.id, id))
        .returning();
      return updated;
    });
  },
  { roles: ["admin", "pharmacist"] },
);
