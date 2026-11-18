import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@/db";
import { route } from "@/lib/server/api";
import { shiftSummary } from "@/lib/server/shifts";

export const GET = route(async ({ db, user }) => {
  const [shift] = await db
    .select()
    .from(schema.shifts)
    .where(and(eq(schema.shifts.userId, user.id), isNull(schema.shifts.closedAt)))
    .limit(1);
  if (!shift) return { shift: null };
  return { shift, summary: await shiftSummary(db, shift) };
});
