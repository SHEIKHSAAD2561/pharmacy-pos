import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, notFound, route } from "@/lib/server/api";

const Adjust = z.object({
  batchId: z.number().int().positive(),
  /** Positive to add units, negative to remove. */
  quantityChange: z.number().int().refine((n) => n !== 0, "Change cannot be zero"),
  type: z.enum(["adjustment", "expired", "damaged"]).default("adjustment"),
  note: z.string().default(""),
});

export const POST = route(
  async ({ req, db, user }) => {
    const input = await body(req, Adjust);
    return db.transaction(async (tx) => {
      const [batch] = await tx.select().from(schema.batches).where(eq(schema.batches.id, input.batchId)).for("update");
      if (!batch) throw notFound("Batch");
      const newQty = batch.quantity + input.quantityChange;
      if (newQty < 0) throw badRequest(`Only ${batch.quantity} units are in this batch`);
      if (input.type !== "adjustment" && input.quantityChange > 0) {
        throw badRequest("Write-offs must remove stock");
      }
      await tx.update(schema.batches).set({ quantity: newQty }).where(eq(schema.batches.id, batch.id));
      await tx.insert(schema.stockMovements).values({
        productId: batch.productId,
        batchId: batch.id,
        type: input.type,
        quantity: input.quantityChange,
        reference: batch.batchNumber,
        note: input.note,
        userId: user.id,
      });
      return { ...batch, quantity: newQty };
    });
  },
  { roles: ["admin", "pharmacist"] },
);
