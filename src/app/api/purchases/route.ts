import { z } from "zod";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { body, roundMoney, route, searchParam } from "@/lib/server/api";

const po = schema.purchaseOrders;

export const GET = route(async ({ req, db }) => {
  const status = searchParam(req, "status");
  const q = searchParam(req, "q");
  const where: SQL[] = [];
  if (status) where.push(eq(po.status, status as (typeof po.status.enumValues)[number]));
  if (q) where.push(or(ilike(po.poNumber, `%${q}%`), ilike(schema.suppliers.name, `%${q}%`))!);
  return db
    .select({
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: schema.suppliers.name,
      status: po.status,
      expectedDate: po.expectedDate,
      total: po.total,
      createdAt: po.createdAt,
      receivedAt: po.receivedAt,
      itemCount: sql<number>`(select count(*) from purchase_order_items i where i.purchase_order_id = "purchase_orders"."id")::int`,
    })
    .from(po)
    .innerJoin(schema.suppliers, eq(po.supplierId, schema.suppliers.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(po.createdAt))
    .limit(300);
});

const PurchaseInput = z.object({
  supplierId: z.number().int().positive("Choose a supplier"),
  expectedDate: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => v || null),
  notes: z.string().default(""),
  status: z.enum(["draft", "ordered"]).default("draft"),
  taxRate: z.number().min(0).max(100).default(0),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        costPrice: z.number().min(0),
      }),
    )
    .min(1, "Add at least one item"),
});

export const POST = route(
  async ({ req, db, user }) => {
    const { items, taxRate, ...input } = await body(req, PurchaseInput);
    const subtotal = roundMoney(items.reduce((s, i) => s + i.quantity * i.costPrice, 0));
    const tax = roundMoney((subtotal * taxRate) / 100);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(po)
        .values({
          ...input,
          poNumber: `TMP-${crypto.randomUUID()}`,
          subtotal,
          tax,
          total: roundMoney(subtotal + tax),
          createdBy: user.id,
        })
        .returning();
      const poNumber = `PO-${String(row.id).padStart(6, "0")}`;
      await tx.update(po).set({ poNumber }).where(eq(po.id, row.id));
      await tx.insert(schema.purchaseOrderItems).values(items.map((i) => ({ ...i, purchaseOrderId: row.id })));
      return { ...row, poNumber };
    });
  },
  { roles: ["admin", "pharmacist"] },
);
