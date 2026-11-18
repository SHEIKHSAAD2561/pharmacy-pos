import { z } from "zod";
import { and, count, eq, ne } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, idParam, notFound, route } from "@/lib/server/api";
import { hashPassword } from "@/lib/server/auth";

const u = schema.users;

const Update = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "pharmacist", "cashier"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const PUT = route<{ id: string }>(
  async ({ req, db, user, params }) => {
    const id = idParam(params.id);
    const { password, ...input } = await body(req, Update);
    const [target] = await db.select().from(u).where(eq(u.id, id));
    if (!target) throw notFound("User");

    const losingAdmin =
      target.role === "admin" && ((input.role && input.role !== "admin") || input.active === false);
    if (losingAdmin) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(u)
        .where(and(eq(u.role, "admin"), eq(u.active, true), ne(u.id, id)));
      if (value === 0) throw badRequest("There must be at least one active administrator");
    }
    if (id === user.id && input.active === false) throw badRequest("You cannot deactivate your own account");

    const patch: Partial<typeof u.$inferInsert> = { ...input };
    if (input.email) patch.email = input.email.toLowerCase();
    if (password) patch.passwordHash = await hashPassword(password);
    const [row] = await db
      .update(u)
      .set(patch)
      .where(eq(u.id, id))
      .returning({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active });

    if (input.active === false || password) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    }
    return row;
  },
  { roles: ["admin"] },
);
