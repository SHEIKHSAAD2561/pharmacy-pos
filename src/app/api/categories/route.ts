import { z } from "zod";
import { asc, sql } from "drizzle-orm";
import { schema } from "@/db";
import { body, route } from "@/lib/server/api";

export const GET = route(async ({ db }) =>
  db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      color: schema.categories.color,
      productCount: sql<number>`(select count(*) from products p where p.category_id = "categories"."id")::int`,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.name)),
);

const Category = z.object({ name: z.string().trim().min(1), color: z.string().default("emerald") });

export const POST = route(
  async ({ req, db }) => {
    const input = await body(req, Category);
    const [row] = await db.insert(schema.categories).values(input).returning();
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);
