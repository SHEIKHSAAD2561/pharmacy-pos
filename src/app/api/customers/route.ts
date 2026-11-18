import { asc, ilike, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { body, route, searchParam } from "@/lib/server/api";
import { CustomerInput } from "@/lib/server/validation";

const c = schema.customers;

export const GET = route(async ({ req, db }) => {
  const q = searchParam(req, "q");
  const limit = Math.min(Number(searchParam(req, "limit")) || 500, 1000);
  return db
    .select({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      address: c.address,
      allergies: c.allergies,
      chronicConditions: c.chronicConditions,
      insuranceProvider: c.insuranceProvider,
      insuranceNumber: c.insuranceNumber,
      insuranceCoverage: c.insuranceCoverage,
      loyaltyPoints: c.loyaltyPoints,
      notes: c.notes,
      createdAt: c.createdAt,
      visits: sql<number>`(select count(*) from sales s where s.customer_id = "customers"."id")::int`,
      totalSpent: sql<number>`coalesce((select sum(s.total - s.refunded_amount) from sales s where s.customer_id = "customers"."id"), 0)::float8`,
      lastVisit: sql<string | null>`(select max(s.created_at) from sales s where s.customer_id = "customers"."id")`,
    })
    .from(c)
    .where(
      q
        ? or(ilike(c.name, `%${q}%`), ilike(c.phone, `%${q}%`), ilike(c.email, `%${q}%`), ilike(c.insuranceNumber, `%${q}%`))
        : undefined,
    )
    .orderBy(asc(c.name))
    .limit(limit);
});

export const POST = route(async ({ req, db }) => {
  const input = await body(req, CustomerInput);
  const [row] = await db.insert(c).values(input).returning();
  return row;
});
