import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { and, asc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { ApiError, badRequest, notFound, roundMoney, todayISO } from "./api";
import type { SessionUser } from "./auth";
import type { Settings } from "./settings";
import { allergyWarnings } from "@/lib/allergies";

export const SaleInput = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  prescriptionId: z.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        /** Line discount as a fixed amount. */
        discount: z.number().min(0).default(0),
      }),
    )
    .min(1, "Add at least one item to the cart"),
  /** Order-level discount as a fixed amount. */
  discount: z.number().min(0).default(0),
  useInsurance: z.boolean().default(false),
  pointsToRedeem: z.number().int().min(0).default(0),
  payments: z.object({
    cash: z.number().min(0).default(0),
    card: z.number().min(0).default(0),
    other: z.number().min(0).default(0),
  }),
  paymentReference: z.string().default(""),
  notes: z.string().default(""),
});

export type SaleInputT = z.infer<typeof SaleInput>;

/** Quote shape shared by the POS preview and the final sale. */
export type Quote = {
  lines: {
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    gross: number;
    discount: number;
    tax: number;
    total: number;
    requiresPrescription: boolean;
    controlled: boolean;
    taxable: boolean;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insuranceAmount: number;
  pointsRedeemed: number;
  pointsValue: number;
  amountDue: number;
  warnings: string[];
};

type ProductRow = typeof schema.products.$inferSelect;
type CustomerRow = typeof schema.customers.$inferSelect;

export function computeQuote(
  input: Pick<SaleInputT, "items" | "discount" | "useInsurance" | "pointsToRedeem">,
  products: Map<number, ProductRow>,
  customer: CustomerRow | null,
  settings: Settings,
): Quote {
  const d = settings.currencyDecimals;
  const rate = Number(settings.taxRate) || 0;

  // 1. Gross and line discounts
  const draft = input.items.map((item) => {
    const product = products.get(item.productId);
    if (!product) throw notFound(`Product #${item.productId}`);
    const gross = roundMoney(product.sellPrice * item.quantity, d);
    const lineDiscount = Math.min(roundMoney(item.discount, d), gross);
    return { item, product, gross, lineDiscount };
  });

  // 2. Spread the order discount across lines in proportion to their net value
  const netBeforeOrderDiscount = draft.reduce((s, l) => s + (l.gross - l.lineDiscount), 0);
  const orderDiscount = Math.min(roundMoney(input.discount, d), roundMoney(netBeforeOrderDiscount, d));
  let remainingOrderDiscount = orderDiscount;

  const lines = draft.map((l, idx) => {
    const lineNet = l.gross - l.lineDiscount;
    let share =
      idx === draft.length - 1
        ? remainingOrderDiscount
        : netBeforeOrderDiscount > 0
          ? roundMoney((orderDiscount * lineNet) / netBeforeOrderDiscount, d)
          : 0;
    share = Math.min(share, lineNet);
    remainingOrderDiscount = roundMoney(remainingOrderDiscount - share, d);

    const discount = roundMoney(l.lineDiscount + share, d);
    const net = roundMoney(l.gross - discount, d);
    let tax = 0;
    let total = net;
    if (l.product.taxable && rate > 0) {
      if (settings.pricesIncludeTax) {
        tax = roundMoney((net * rate) / (100 + rate), d);
      } else {
        tax = roundMoney((net * rate) / 100, d);
        total = roundMoney(net + tax, d);
      }
    }
    return {
      productId: l.product.id,
      name: [l.product.name, l.product.strength].filter(Boolean).join(" "),
      quantity: l.item.quantity,
      unitPrice: l.product.sellPrice,
      costPrice: l.product.costPrice,
      gross: l.gross,
      discount,
      tax,
      total,
      requiresPrescription: l.product.requiresPrescription,
      controlled: l.product.controlled,
      taxable: l.product.taxable,
    };
  });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.gross, 0), d);
  const discount = roundMoney(lines.reduce((s, l) => s + l.discount, 0), d);
  const tax = roundMoney(lines.reduce((s, l) => s + l.tax, 0), d);
  const total = roundMoney(lines.reduce((s, l) => s + l.total, 0), d);

  // 3. Insurance covers a share of prescription items
  let insuranceAmount = 0;
  if (input.useInsurance && customer && customer.insuranceCoverage > 0 && customer.insuranceProvider) {
    const rxTotal = lines.filter((l) => l.requiresPrescription).reduce((s, l) => s + l.total, 0);
    insuranceAmount = roundMoney((rxTotal * customer.insuranceCoverage) / 100, d);
  }

  // 4. Loyalty points
  let pointsRedeemed = 0;
  let pointsValue = 0;
  if (settings.loyaltyEnabled && customer && input.pointsToRedeem > 0) {
    const value = Number(settings.loyaltyPointValue) || 0;
    const available = Math.min(input.pointsToRedeem, customer.loyaltyPoints);
    const maxByAmount = value > 0 ? Math.floor((total - insuranceAmount) / value) : 0;
    pointsRedeemed = Math.max(0, Math.min(available, maxByAmount));
    pointsValue = roundMoney(pointsRedeemed * value, d);
  }

  const amountDue = roundMoney(Math.max(0, total - insuranceAmount - pointsValue), d);
  const warnings = customer
    ? allergyWarnings(
        customer.allergies,
        draft.map((l) => ({ name: l.product.name, genericName: l.product.genericName })),
      )
    : [];
  return { lines, subtotal, discount, tax, total, insuranceAmount, pointsRedeemed, pointsValue, amountDue, warnings };
}

async function loadContext(tx: Tx, input: Pick<SaleInputT, "items" | "customerId">) {
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const rows = await tx.select().from(schema.products).where(inArray(schema.products.id, ids));
  const products = new Map(rows.map((r) => [r.id, r]));
  let customer: CustomerRow | null = null;
  if (input.customerId) {
    const [c] = await tx.select().from(schema.customers).where(eq(schema.customers.id, input.customerId));
    if (!c) throw notFound("Customer");
    customer = c;
  }
  return { products, customer };
}

export const QuoteInput = SaleInput.pick({
  customerId: true,
  items: true,
  discount: true,
  useInsurance: true,
  pointsToRedeem: true,
});

export async function quoteSale(tx: Tx, input: z.infer<typeof QuoteInput>, settings: Settings) {
  const { products, customer } = await loadContext(tx, input);
  return computeQuote(input, products, customer, settings);
}

function tempNumber() {
  return `TMP-${crypto.randomUUID()}`;
}

export async function createSale(tx: Tx, input: SaleInputT, user: SessionUser, settings: Settings) {
  const d = settings.currencyDecimals;
  const { products, customer } = await loadContext(tx, input);

  for (const item of input.items) {
    const p = products.get(item.productId);
    if (!p) throw notFound(`Product #${item.productId}`);
    if (!p.active) throw badRequest(`${p.name} is inactive and cannot be sold`);
  }

  // Merge duplicate lines of the same product
  const merged = new Map<number, SaleInputT["items"][number]>();
  for (const item of input.items) {
    const prev = merged.get(item.productId);
    merged.set(item.productId, prev ? { ...prev, quantity: prev.quantity + item.quantity, discount: prev.discount + item.discount } : { ...item });
  }
  const items = [...merged.values()];
  const quote = computeQuote({ ...input, items }, products, customer, settings);

  // Prescription & controlled-drug rules
  let prescription: typeof schema.prescriptions.$inferSelect | null = null;
  if (input.prescriptionId) {
    const [rx] = await tx.select().from(schema.prescriptions).where(eq(schema.prescriptions.id, input.prescriptionId));
    if (!rx) throw notFound("Prescription");
    if (rx.status !== "pending") throw badRequest(`Prescription ${rx.code} is already ${rx.status}`);
    if (input.customerId && rx.customerId !== input.customerId) {
      throw badRequest("The prescription belongs to a different patient");
    }
    prescription = rx;
  }
  const rxLines = quote.lines.filter((l) => l.requiresPrescription);
  if (settings.requirePrescriptionCheck && rxLines.length && !prescription) {
    throw badRequest(
      `A prescription is required for: ${rxLines.map((l) => l.name).join(", ")}. Attach a prescription to continue.`,
    );
  }
  if (quote.lines.some((l) => l.controlled) && user.role === "cashier") {
    throw new ApiError(403, "Controlled medicines must be dispensed by a pharmacist");
  }

  // Payments
  const cash = roundMoney(input.payments.cash, d);
  const card = roundMoney(input.payments.card, d);
  const other = roundMoney(input.payments.other, d);
  const paid = roundMoney(cash + card + other, d);
  if (paid + 1e-9 < quote.amountDue) {
    throw badRequest("The amount paid is less than the amount due");
  }
  if (card + other > quote.amountDue + 1e-9) {
    throw badRequest("Card and other payments cannot exceed the amount due");
  }
  const changeGiven = roundMoney(paid - quote.amountDue, d);
  const methods = [cash > 0 && "cash", card > 0 && "card", other > 0 && "other"].filter(Boolean) as string[];
  const paymentMethod =
    methods.length > 1
      ? "mixed"
      : methods[0] ?? (quote.insuranceAmount > 0 ? "insurance" : quote.pointsValue > 0 ? "points" : "cash");

  // Active shift for this user (optional)
  const [shift] = await tx
    .select({ id: schema.shifts.id })
    .from(schema.shifts)
    .where(and(eq(schema.shifts.userId, user.id), isNull(schema.shifts.closedAt)))
    .limit(1);

  const [sale] = await tx
    .insert(schema.sales)
    .values({
      invoiceNo: tempNumber(),
      customerId: customer?.id ?? null,
      userId: user.id,
      shiftId: shift?.id ?? null,
      prescriptionId: prescription?.id ?? null,
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      total: quote.total,
      insuranceAmount: quote.insuranceAmount,
      pointsRedeemed: quote.pointsRedeemed,
      pointsValue: quote.pointsValue,
      amountDue: quote.amountDue,
      cashAmount: cash,
      cardAmount: card,
      otherAmount: other,
      changeGiven,
      paymentMethod,
      paymentReference: input.paymentReference,
      notes: input.notes,
    })
    .returning();

  const invoiceNo = `${settings.invoicePrefix}-${String(sale.id).padStart(6, "0")}`;
  await tx.update(schema.sales).set({ invoiceNo }).where(eq(schema.sales.id, sale.id));

  // Allocate stock: first-expiry, first-out
  const today = todayISO();
  for (const line of quote.lines) {
    const batchRows = await tx
      .select()
      .from(schema.batches)
      .where(
        and(
          eq(schema.batches.productId, line.productId),
          gt(schema.batches.quantity, 0),
          settings.blockExpiredSales ? gte(schema.batches.expiryDate, today) : sql`true`,
        ),
      )
      .orderBy(asc(schema.batches.expiryDate), asc(schema.batches.id))
      .for("update");

    const available = batchRows.reduce((s, b) => s + b.quantity, 0);
    if (available < line.quantity) {
      throw badRequest(`Not enough stock for ${line.name}. Available: ${available}, requested: ${line.quantity}`);
    }

    let remaining = line.quantity;
    let allocatedDiscount = 0;
    let allocatedTax = 0;
    let allocatedTotal = 0;
    const allocations = [];
    for (const batch of batchRows) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      remaining -= take;
      allocations.push({ batch, take });
    }
    for (let i = 0; i < allocations.length; i++) {
      const { batch, take } = allocations[i];
      const last = i === allocations.length - 1;
      const ratio = take / line.quantity;
      const discount = last ? roundMoney(line.discount - allocatedDiscount, d) : roundMoney(line.discount * ratio, d);
      const tax = last ? roundMoney(line.tax - allocatedTax, d) : roundMoney(line.tax * ratio, d);
      const total = last ? roundMoney(line.total - allocatedTotal, d) : roundMoney(line.total * ratio, d);
      allocatedDiscount += discount;
      allocatedTax += tax;
      allocatedTotal += total;

      await tx
        .update(schema.batches)
        .set({ quantity: batch.quantity - take })
        .where(eq(schema.batches.id, batch.id));
      await tx.insert(schema.saleItems).values({
        saleId: sale.id,
        productId: line.productId,
        batchId: batch.id,
        name: line.name,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity: take,
        unitPrice: line.unitPrice,
        costPrice: batch.costPrice || line.costPrice,
        discount,
        tax,
        total,
      });
      await tx.insert(schema.stockMovements).values({
        productId: line.productId,
        batchId: batch.id,
        type: "sale",
        quantity: -take,
        reference: invoiceNo,
        userId: user.id,
      });
    }
  }

  // Loyalty
  if (customer && settings.loyaltyEnabled) {
    const earned = Math.floor(quote.amountDue * (Number(settings.loyaltyPointsPerUnit) || 0));
    const newPoints = Math.max(0, customer.loyaltyPoints - quote.pointsRedeemed + earned);
    await tx.update(schema.customers).set({ loyaltyPoints: newPoints }).where(eq(schema.customers.id, customer.id));
  }

  if (prescription) {
    await tx
      .update(schema.prescriptions)
      .set({ status: "dispensed", saleId: sale.id })
      .where(eq(schema.prescriptions.id, prescription.id));
  }

  return { id: sale.id, invoiceNo, changeGiven, amountDue: quote.amountDue };
}

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

export const ReturnInput = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        restock: z.boolean().default(true),
      }),
    )
    .min(1, "Select at least one item to return"),
  reason: z.string().trim().min(1, "Please give a reason"),
  refundMethod: z.enum(["cash", "card", "other"]).default("cash"),
});

export async function createReturn(
  tx: Tx,
  saleId: number,
  input: z.infer<typeof ReturnInput>,
  user: SessionUser,
  settings: Settings,
) {
  const d = settings.currencyDecimals;
  const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.id, saleId)).for("update");
  if (!sale) throw notFound("Sale");
  if (sale.status === "refunded") throw badRequest("This sale has already been fully refunded");

  const saleItems = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId));
  const byId = new Map(saleItems.map((i) => [i.id, i]));

  // Only the share the customer actually paid is refunded (insurance and points excluded)
  const paidRatio = sale.total > 0 ? (sale.amountDue) / sale.total : 0;

  const [ret] = await tx
    .insert(schema.returns)
    .values({ returnNo: tempNumber(), saleId, userId: user.id, reason: input.reason, refundMethod: input.refundMethod })
    .returning();
  const returnNo = `RET-${String(ret.id).padStart(6, "0")}`;

  let refund = 0;
  for (const r of input.items) {
    const item = byId.get(r.saleItemId);
    if (!item) throw badRequest("Item does not belong to this sale");
    const returnable = item.quantity - item.returnedQty;
    if (r.quantity > returnable) throw badRequest(`Only ${returnable} of ${item.name} can be returned`);
    const amount = roundMoney((item.total / item.quantity) * r.quantity * paidRatio, d);
    refund += amount;

    await tx.insert(schema.returnItems).values({
      returnId: ret.id,
      saleItemId: item.id,
      quantity: r.quantity,
      amount,
      restocked: r.restock,
    });
    await tx
      .update(schema.saleItems)
      .set({ returnedQty: item.returnedQty + r.quantity })
      .where(eq(schema.saleItems.id, item.id));
    item.returnedQty += r.quantity;

    if (r.restock && item.batchId) {
      await tx
        .update(schema.batches)
        .set({ quantity: sql`${schema.batches.quantity} + ${r.quantity}` })
        .where(eq(schema.batches.id, item.batchId));
      await tx.insert(schema.stockMovements).values({
        productId: item.productId,
        batchId: item.batchId,
        type: "return",
        quantity: r.quantity,
        reference: returnNo,
        note: input.reason,
        userId: user.id,
      });
    }
  }

  refund = roundMoney(refund, d);
  await tx.update(schema.returns).set({ returnNo, refundAmount: refund }).where(eq(schema.returns.id, ret.id));

  const fullyReturned = saleItems.every((i) => i.returnedQty >= i.quantity);
  await tx
    .update(schema.sales)
    .set({
      refundedAmount: roundMoney(sale.refundedAmount + refund, d),
      status: fullyReturned ? "refunded" : "partially_refunded",
    })
    .where(eq(schema.sales.id, saleId));

  return { id: ret.id, returnNo, refundAmount: refund };
}
