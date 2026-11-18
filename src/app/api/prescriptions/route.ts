import { z } from "zod";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { body, route, searchParam } from "@/lib/server/api";

const rx = schema.prescriptions;

export const GET = route(async ({ req, db }) => {
  const q = searchParam(req, "q");
  const status = searchParam(req, "status");
  const customerId = Number(searchParam(req, "customerId")) || 0;
  const where: SQL[] = [];
  if (status) where.push(eq(rx.status, status as (typeof rx.status.enumValues)[number]));
  if (customerId) where.push(eq(rx.customerId, customerId));
  if (q) where.push(or(ilike(rx.code, `%${q}%`), ilike(schema.customers.name, `%${q}%`), ilike(rx.doctorName, `%${q}%`))!);

  return db
    .select({
      id: rx.id,
      code: rx.code,
      customerId: rx.customerId,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
      doctorName: rx.doctorName,
      clinic: rx.clinic,
      issueDate: rx.issueDate,
      diagnosis: rx.diagnosis,
      status: rx.status,
      saleId: rx.saleId,
      createdAt: rx.createdAt,
      itemCount: sql<number>`(select count(*) from prescription_items i where i.prescription_id = "prescriptions"."id")::int`,
    })
    .from(rx)
    .innerJoin(schema.customers, eq(rx.customerId, schema.customers.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(rx.createdAt))
    .limit(300);
});

const Create = z.object({
  customerId: z.number().int().positive(),
  doctorName: z.string().trim().min(1, "Doctor name is required"),
  doctorLicense: z.string().default(""),
  clinic: z.string().default(""),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  diagnosis: z.string().default(""),
  notes: z.string().default(""),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        dosage: z.string().default(""),
        duration: z.string().default(""),
        instructions: z.string().default(""),
      }),
    )
    .min(1, "Add at least one medicine"),
});

export const POST = route(
  async ({ req, db, user }) => {
    const { items, ...input } = await body(req, Create);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(rx)
        .values({ ...input, code: `TMP-${crypto.randomUUID()}`, createdBy: user.id })
        .returning();
      const code = `RX-${String(row.id).padStart(6, "0")}`;
      await tx.update(rx).set({ code }).where(eq(rx.id, row.id));
      await tx.insert(schema.prescriptionItems).values(items.map((i) => ({ ...i, prescriptionId: row.id })));
      return { ...row, code };
    });
  },
  { roles: ["admin", "pharmacist"] },
);
