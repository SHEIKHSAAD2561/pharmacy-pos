import { z } from "zod";
import { asc } from "drizzle-orm";
import { schema } from "@/db";
import { body, route } from "@/lib/server/api";
import { hashPassword } from "@/lib/server/auth";

const u = schema.users;

export const GET = route(
  async ({ db }) =>
    db
      .select({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })
      .from(u)
      .orderBy(asc(u.name)),
  { roles: ["admin"] },
);

const Create = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "pharmacist", "cashier"]),
});

export const POST = route(
  async ({ req, db }) => {
    const input = await body(req, Create);
    const [row] = await db
      .insert(u)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role,
        passwordHash: await hashPassword(input.password),
      })
      .returning({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active });
    return row;
  },
  { roles: ["admin"] },
);
