import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import { ApiError, body, route } from "@/lib/server/api";
import { createSession, verifyPassword } from "@/lib/server/auth";

const Login = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = route(
  async ({ req, db }) => {
    const { email, password } = await body(req, Login);
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(sql`lower(${schema.users.email})`, email.toLowerCase()))
      .limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(401, "Incorrect email or password");
    }
    if (!user.active) throw new ApiError(403, "This account has been deactivated");
    await createSession(user.id);
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  },
  { public: true },
);
