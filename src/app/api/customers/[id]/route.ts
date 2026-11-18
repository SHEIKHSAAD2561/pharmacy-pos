import { desc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { body, idParam, notFound, route } from "@/lib/server/api";
import { CustomerInput } from "@/lib/server/validation";

const c = schema.customers;

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const id = idParam(params.id);
  const [customer] = await db.select().from(c).where(eq(c.id, id));
  if (!customer) throw notFound("Customer");

  const sales = await db
    .select({
      id: schema.sales.id,
      invoiceNo: schema.sales.invoiceNo,
      total: schema.sales.total,
      amountDue: schema.sales.amountDue,
      status: schema.sales.status,
      paymentMethod: schema.sales.paymentMethod,
      createdAt: schema.sales.createdAt,
    })
    .from(schema.sales)
    .where(eq(schema.sales.customerId, id))
    .orderBy(desc(schema.sales.createdAt))
    .limit(50);

  const prescriptions = await db
    .select({
      id: schema.prescriptions.id,
      code: schema.prescriptions.code,
      doctorName: schema.prescriptions.doctorName,
      issueDate: schema.prescriptions.issueDate,
      status: schema.prescriptions.status,
    })
    .from(schema.prescriptions)
    .where(eq(schema.prescriptions.customerId, id))
    .orderBy(desc(schema.prescriptions.createdAt))
    .limit(50);

  return { ...customer, sales, prescriptions };
});

export const PUT = route<{ id: string }>(async ({ req, db, params }) => {
  const input = await body(req, CustomerInput.partial());
  const [row] = await db.update(c).set(input).where(eq(c.id, idParam(params.id))).returning();
  if (!row) throw notFound("Customer");
  return row;
});

export const DELETE = route<{ id: string }>(
  async ({ db, params }) => {
    await db.delete(c).where(eq(c.id, idParam(params.id)));
    return { ok: true };
  },
  { roles: ["admin"] },
);
