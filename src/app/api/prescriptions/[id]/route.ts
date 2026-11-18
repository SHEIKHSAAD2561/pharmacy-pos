import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, idParam, notFound, route } from "@/lib/server/api";
import { stockSql } from "@/lib/server/inventory";
import { allergyWarnings } from "@/lib/allergies";

const rx = schema.prescriptions;

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const id = idParam(params.id);
  const [row] = await db
    .select({ rx, customer: schema.customers, createdByName: schema.users.name })
    .from(rx)
    .innerJoin(schema.customers, eq(rx.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(rx.createdBy, schema.users.id))
    .where(eq(rx.id, id));
  if (!row) throw notFound("Prescription");

  const items = await db
    .select({
      id: schema.prescriptionItems.id,
      productId: schema.prescriptionItems.productId,
      quantity: schema.prescriptionItems.quantity,
      dosage: schema.prescriptionItems.dosage,
      duration: schema.prescriptionItems.duration,
      instructions: schema.prescriptionItems.instructions,
      productName: schema.products.name,
      genericName: schema.products.genericName,
      strength: schema.products.strength,
      dosageForm: schema.products.dosageForm,
      sellPrice: schema.products.sellPrice,
      stock: stockSql,
    })
    .from(schema.prescriptionItems)
    .innerJoin(schema.products, eq(schema.prescriptionItems.productId, schema.products.id))
    .where(eq(schema.prescriptionItems.prescriptionId, id));

  const warnings = allergyWarnings(
    row.customer.allergies,
    items.map((i) => ({ name: i.productName, genericName: i.genericName })),
  );

  return { ...row.rx, customer: row.customer, createdByName: row.createdByName, items, warnings };
});

const Update = z.object({ status: z.enum(["pending", "cancelled"]) });

export const PATCH = route<{ id: string }>(
  async ({ req, db, params }) => {
    const { status } = await body(req, Update);
    const id = idParam(params.id);
    const [current] = await db.select().from(rx).where(eq(rx.id, id));
    if (!current) throw notFound("Prescription");
    if (current.status === "dispensed") throw badRequest("A dispensed prescription cannot be changed");
    const [row] = await db.update(rx).set({ status }).where(eq(rx.id, id)).returning();
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);
