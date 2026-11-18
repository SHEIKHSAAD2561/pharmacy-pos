import { asc, ilike, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { body, route, searchParam } from "@/lib/server/api";
import { SupplierInput } from "@/lib/server/validation";

const s = schema.suppliers;

export const GET = route(async ({ req, db }) => {
  const q = searchParam(req, "q");
  return db
    .select({
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      taxNumber: s.taxNumber,
      paymentTerms: s.paymentTerms,
      notes: s.notes,
      active: s.active,
      createdAt: s.createdAt,
      orderCount: sql<number>`(select count(*) from purchase_orders po where po.supplier_id = "suppliers"."id")::int`,
      totalPurchased: sql<number>`coalesce((select sum(po.total) from purchase_orders po where po.supplier_id = "suppliers"."id" and po.status in ('received','partially_received')), 0)::float8`,
    })
    .from(s)
    .where(q ? or(ilike(s.name, `%${q}%`), ilike(s.contactPerson, `%${q}%`), ilike(s.phone, `%${q}%`)) : undefined)
    .orderBy(asc(s.name));
});

export const POST = route(
  async ({ req, db }) => {
    const input = await body(req, SupplierInput);
    const [row] = await db.insert(s).values(input).returning();
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);

