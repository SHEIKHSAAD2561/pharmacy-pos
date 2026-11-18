import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db";

const p = schema.products;

/** Sellable stock: quantity in batches that have not expired. */
export const stockSql = sql<number>`coalesce((select sum(b.quantity) from batches b where b.product_id = "products"."id" and b.quantity > 0 and b.expiry_date >= current_date), 0)::int`;

/** Units sitting in expired batches that still need to be written off. */
export const expiredStockSql = sql<number>`coalesce((select sum(b.quantity) from batches b where b.product_id = "products"."id" and b.quantity > 0 and b.expiry_date < current_date), 0)::int`;

/** Earliest upcoming expiry among batches with stock. */
export const nextExpirySql = sql<string | null>`(select min(b.expiry_date)::text from batches b where b.product_id = "products"."id" and b.quantity > 0 and b.expiry_date >= current_date)`;

/** Stock value at batch cost. */
export const stockValueSql = sql<number>`coalesce((select sum(b.quantity * b.cost_price) from batches b where b.product_id = "products"."id" and b.quantity > 0 and b.expiry_date >= current_date), 0)::float8`;

export const productListColumns = {
  id: p.id,
  name: p.name,
  genericName: p.genericName,
  brand: p.brand,
  manufacturer: p.manufacturer,
  categoryId: p.categoryId,
  categoryName: schema.categories.name,
  categoryColor: schema.categories.color,
  dosageForm: p.dosageForm,
  strength: p.strength,
  packSize: p.packSize,
  unit: p.unit,
  sku: p.sku,
  barcode: p.barcode,
  sellPrice: p.sellPrice,
  costPrice: p.costPrice,
  taxable: p.taxable,
  requiresPrescription: p.requiresPrescription,
  controlled: p.controlled,
  reorderLevel: p.reorderLevel,
  shelfLocation: p.shelfLocation,
  storage: p.storage,
  description: p.description,
  active: p.active,
  stock: stockSql,
  expiredStock: expiredStockSql,
  nextExpiry: nextExpirySql,
};
