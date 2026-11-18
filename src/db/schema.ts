import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2, mode: "number" }).notNull().default(0);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Users & sessions                                                    */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "pharmacist", "cashier"] }).notNull().default("cashier"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Settings (single row, id = 1)                                       */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  pharmacyName: text("pharmacy_name").notNull().default("My Pharmacy"),
  legalName: text("legal_name").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  licenseNumber: text("license_number").notNull().default(""),
  taxNumber: text("tax_number").notNull().default(""),
  currencyCode: text("currency_code").notNull().default("USD"),
  currencySymbol: text("currency_symbol").notNull().default(""),
  currencyDecimals: integer("currency_decimals").notNull().default(2),
  locale: text("locale").notNull().default("en-US"),
  timezone: text("timezone").notNull().default("UTC"),
  taxName: text("tax_name").notNull().default("VAT"),
  taxRate: numeric("tax_rate", { precision: 6, scale: 3, mode: "number" }).notNull().default(0),
  pricesIncludeTax: boolean("prices_include_tax").notNull().default(false),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  receiptHeader: text("receipt_header").notNull().default(""),
  receiptFooter: text("receipt_footer").notNull().default("Thank you for your visit. Get well soon!"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
  expiryAlertDays: integer("expiry_alert_days").notNull().default(90),
  blockExpiredSales: boolean("block_expired_sales").notNull().default(true),
  requirePrescriptionCheck: boolean("require_prescription_check").notNull().default(true),
  loyaltyEnabled: boolean("loyalty_enabled").notNull().default(true),
  loyaltyPointsPerUnit: numeric("loyalty_points_per_unit", { precision: 8, scale: 3, mode: "number" })
    .notNull()
    .default(1),
  loyaltyPointValue: numeric("loyalty_point_value", { precision: 8, scale: 4, mode: "number" })
    .notNull()
    .default(0.01),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("emerald"),
  createdAt: createdAt(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  taxNumber: text("tax_number").notNull().default(""),
  paymentTerms: text("payment_terms").notNull().default(""),
  notes: text("notes").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    genericName: text("generic_name").notNull().default(""),
    brand: text("brand").notNull().default(""),
    manufacturer: text("manufacturer").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    dosageForm: text("dosage_form").notNull().default(""),
    strength: text("strength").notNull().default(""),
    packSize: text("pack_size").notNull().default(""),
    unit: text("unit").notNull().default("pcs"),
    sku: text("sku").notNull().default(""),
    barcode: text("barcode"),
    description: text("description").notNull().default(""),
    sellPrice: money("sell_price"),
    costPrice: money("cost_price"),
    taxable: boolean("taxable").notNull().default(true),
    requiresPrescription: boolean("requires_prescription").notNull().default(false),
    controlled: boolean("controlled").notNull().default(false),
    reorderLevel: integer("reorder_level").notNull().default(10),
    shelfLocation: text("shelf_location").notNull().default(""),
    storage: text("storage").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("products_barcode_idx").on(t.barcode), index("products_name_idx").on(t.name)],
);

export const batches = pgTable(
  "batches",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    expiryDate: date("expiry_date", { mode: "string" }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    initialQuantity: integer("initial_quantity").notNull().default(0),
    costPrice: money("cost_price"),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    purchaseOrderId: integer("purchase_order_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("batches_product_idx").on(t.productId), index("batches_expiry_idx").on(t.expiryDate)],
);

/* ------------------------------------------------------------------ */
/* Customers & prescriptions                                           */
/* ------------------------------------------------------------------ */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  gender: text("gender").notNull().default(""),
  address: text("address").notNull().default(""),
  allergies: text("allergies").notNull().default(""),
  chronicConditions: text("chronic_conditions").notNull().default(""),
  insuranceProvider: text("insurance_provider").notNull().default(""),
  insuranceNumber: text("insurance_number").notNull().default(""),
  insuranceCoverage: numeric("insurance_coverage", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
});

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  doctorName: text("doctor_name").notNull(),
  doctorLicense: text("doctor_license").notNull().default(""),
  clinic: text("clinic").notNull().default(""),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  diagnosis: text("diagnosis").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["pending", "dispensed", "cancelled"] }).notNull().default("pending"),
  saleId: integer("sale_id"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const prescriptionItems = pgTable("prescription_items", {
  id: serial("id").primaryKey(),
  prescriptionId: integer("prescription_id")
    .notNull()
    .references(() => prescriptions.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  dosage: text("dosage").notNull().default(""),
  duration: text("duration").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
});

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  openedAt: createdAt(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCash: money("opening_cash"),
  closingCash: numeric("closing_cash", { precision: 14, scale: 2, mode: "number" }),
  expectedCash: numeric("expected_cash", { precision: 14, scale: 2, mode: "number" }),
  notes: text("notes").notNull().default(""),
});

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    invoiceNo: text("invoice_no").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    prescriptionId: integer("prescription_id"),
    subtotal: money("subtotal"),
    discount: money("discount"),
    tax: money("tax"),
    total: money("total"),
    insuranceAmount: money("insurance_amount"),
    pointsRedeemed: integer("points_redeemed").notNull().default(0),
    pointsValue: money("points_value"),
    amountDue: money("amount_due"),
    cashAmount: money("cash_amount"),
    cardAmount: money("card_amount"),
    otherAmount: money("other_amount"),
    changeGiven: money("change_given"),
    paymentMethod: text("payment_method").notNull().default("cash"),
    paymentReference: text("payment_reference").notNull().default(""),
    status: text("status", { enum: ["completed", "partially_refunded", "refunded"] })
      .notNull()
      .default("completed"),
    refundedAmount: money("refunded_amount"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("sales_created_idx").on(t.createdAt)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    batchNumber: text("batch_number").notNull().default(""),
    expiryDate: date("expiry_date", { mode: "string" }),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price"),
    costPrice: money("cost_price"),
    discount: money("discount"),
    tax: money("tax"),
    total: money("total"),
    returnedQty: integer("returned_qty").notNull().default(0),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)],
);

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  returnNo: text("return_no").notNull().unique(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull().default(""),
  refundMethod: text("refund_method").notNull().default("cash"),
  refundAmount: money("refund_amount"),
  createdAt: createdAt(),
});

export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id")
    .notNull()
    .references(() => returns.id, { onDelete: "cascade" }),
  saleItemId: integer("sale_item_id")
    .notNull()
    .references(() => saleItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  amount: money("amount"),
  restocked: boolean("restocked").notNull().default(true),
});

/* ------------------------------------------------------------------ */
/* Purchasing                                                          */
/* ------------------------------------------------------------------ */

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["draft", "ordered", "partially_received", "received", "cancelled"] })
    .notNull()
    .default("draft"),
  expectedDate: date("expected_date", { mode: "string" }),
  subtotal: money("subtotal"),
  tax: money("tax"),
  total: money("total"),
  notes: text("notes").notNull().default(""),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  costPrice: money("cost_price"),
  receivedQty: integer("received_qty").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Stock movements (audit trail)                                       */
/* ------------------------------------------------------------------ */

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
    type: text("type", {
      enum: ["purchase", "sale", "return", "adjustment", "expired", "damaged", "opening"],
    }).notNull(),
    quantity: integer("quantity").notNull(),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);
