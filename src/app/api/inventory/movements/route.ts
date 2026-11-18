import { and, desc, eq, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { route, searchParam } from "@/lib/server/api";

const m = schema.stockMovements;

export const GET = route(async ({ req, db }) => {
  const productId = Number(searchParam(req, "productId")) || 0;
  const type = searchParam(req, "type");
  const where: SQL[] = [];
  if (productId) where.push(eq(m.productId, productId));
  if (type) where.push(eq(m.type, type as (typeof m.type.enumValues)[number]));

  return db
    .select({
      id: m.id,
      productId: m.productId,
      productName: schema.products.name,
      batchNumber: schema.batches.batchNumber,
      type: m.type,
      quantity: m.quantity,
      reference: m.reference,
      note: m.note,
      userName: schema.users.name,
      createdAt: m.createdAt,
    })
    .from(m)
    .innerJoin(schema.products, eq(m.productId, schema.products.id))
    .leftJoin(schema.batches, eq(m.batchId, schema.batches.id))
    .leftJoin(schema.users, eq(m.userId, schema.users.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(m.createdAt), desc(m.id))
    .limit(300);
});
