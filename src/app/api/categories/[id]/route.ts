import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { body, idParam, notFound, route } from "@/lib/server/api";

const Category = z.object({ name: z.string().trim().min(1), color: z.string() }).partial();

export const PUT = route<{ id: string }>(
  async ({ req, db, params }) => {
    const input = await body(req, Category);
    const [row] = await db
      .update(schema.categories)
      .set(input)
      .where(eq(schema.categories.id, idParam(params.id)))
      .returning();
    if (!row) throw notFound("Category");
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);

export const DELETE = route<{ id: string }>(
  async ({ db, params }) => {
    await db.delete(schema.categories).where(eq(schema.categories.id, idParam(params.id)));
    return { ok: true };
  },
  { roles: ["admin"] },
);
