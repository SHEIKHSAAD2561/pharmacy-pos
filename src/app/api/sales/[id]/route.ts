import { asc, desc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { idParam, notFound, route } from "@/lib/server/api";

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const id = idParam(params.id);
  const [sale] = await db
    .select({
      sale: schema.sales,
      customer: schema.customers,
      cashierName: schema.users.name,
    })
    .from(schema.sales)
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .leftJoin(schema.users, eq(schema.sales.userId, schema.users.id))
    .where(eq(schema.sales.id, id));
  if (!sale) throw notFound("Sale");

  const items = await db
    .select()
    .from(schema.saleItems)
    .where(eq(schema.saleItems.saleId, id))
    .orderBy(asc(schema.saleItems.id));

  const returns = await db
    .select({
      id: schema.returns.id,
      returnNo: schema.returns.returnNo,
      reason: schema.returns.reason,
      refundMethod: schema.returns.refundMethod,
      refundAmount: schema.returns.refundAmount,
      createdAt: schema.returns.createdAt,
      userName: schema.users.name,
    })
    .from(schema.returns)
    .leftJoin(schema.users, eq(schema.returns.userId, schema.users.id))
    .where(eq(schema.returns.saleId, id))
    .orderBy(desc(schema.returns.createdAt));

  let prescription = null;
  if (sale.sale.prescriptionId) {
    const [rx] = await db
      .select({ id: schema.prescriptions.id, code: schema.prescriptions.code, doctorName: schema.prescriptions.doctorName })
      .from(schema.prescriptions)
      .where(eq(schema.prescriptions.id, sale.sale.prescriptionId));
    prescription = rx ?? null;
  }

  return { ...sale.sale, customer: sale.customer, cashierName: sale.cashierName, items, returns, prescription };
});
