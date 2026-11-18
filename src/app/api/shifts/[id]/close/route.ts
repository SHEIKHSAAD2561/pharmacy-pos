import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { ApiError, badRequest, body, idParam, notFound, route } from "@/lib/server/api";
import { shiftSummary } from "@/lib/server/shifts";

const Close = z.object({ closingCash: z.number().min(0), notes: z.string().default("") });

export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const input = await body(req, Close);
  const [shift] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, idParam(params.id)));
  if (!shift) throw notFound("Shift");
  if (shift.userId !== user.id && user.role !== "admin") throw new ApiError(403, "You can only close your own shift");
  if (shift.closedAt) throw badRequest("This shift is already closed");
  const closedAt = new Date();
  const summary = await shiftSummary(db, { ...shift, closedAt });
  const [row] = await db
    .update(schema.shifts)
    .set({
      closedAt,
      closingCash: input.closingCash,
      expectedCash: summary.expectedCash,
      notes: [shift.notes, input.notes].filter(Boolean).join("\n"),
    })
    .where(eq(schema.shifts.id, shift.id))
    .returning();
  return { shift: row, summary, difference: Math.round((input.closingCash - summary.expectedCash) * 100) / 100 };
});
