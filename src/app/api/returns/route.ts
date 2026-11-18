import { desc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { route } from "@/lib/server/api";

export const GET = route(async ({ db }) =>
  db
    .select({
      id: schema.returns.id,
      returnNo: schema.returns.returnNo,
      saleId: schema.returns.saleId,
      invoiceNo: schema.sales.invoiceNo,
      reason: schema.returns.reason,
      refundMethod: schema.returns.refundMethod,
      refundAmount: schema.returns.refundAmount,
      userName: schema.users.name,
      createdAt: schema.returns.createdAt,
    })
    .from(schema.returns)
    .innerJoin(schema.sales, eq(schema.returns.saleId, schema.sales.id))
    .leftJoin(schema.users, eq(schema.returns.userId, schema.users.id))
    .orderBy(desc(schema.returns.createdAt))
    .limit(300),
);
