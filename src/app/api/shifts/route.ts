import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, route } from "@/lib/server/api";

const sh = schema.shifts;

export const GET = route(async ({ db, user }) => {
  const where = user.role === "cashier" ? eq(sh.userId, user.id) : undefined;
  return db
    .select({
      id: sh.id,
      userName: schema.users.name,
      openedAt: sh.openedAt,
      closedAt: sh.closedAt,
      openingCash: sh.openingCash,
      closingCash: sh.closingCash,
      expectedCash: sh.expectedCash,
      notes: sh.notes,
    })
    .from(sh)
    .innerJoin(schema.users, eq(sh.userId, schema.users.id))
    .where(where)
    .orderBy(desc(sh.openedAt))
    .limit(200);
});

const Open = z.object({ openingCash: z.number().min(0).default(0), notes: z.string().default("") });

export const POST = route(async ({ req, db, user }) => {
  const input = await body(req, Open);
  const [open] = await db
    .select({ id: sh.id })
    .from(sh)
    .where(and(eq(sh.userId, user.id), isNull(sh.closedAt)));
  if (open) throw badRequest("You already have an open shift");
  const [row] = await db.insert(sh).values({ userId: user.id, ...input }).returning();
  return row;
});
