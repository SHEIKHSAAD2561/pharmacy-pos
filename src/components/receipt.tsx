"use client";

import { formatDateTime, formatMoney, titleCase, type AppSettings } from "@/lib/format";

export type SaleDetail = {
  id: number;
  invoiceNo: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insuranceAmount: number;
  pointsRedeemed: number;
  pointsValue: number;
  amountDue: number;
  cashAmount: number;
  cardAmount: number;
  otherAmount: number;
  changeGiven: number;
  paymentMethod: string;
  paymentReference: string;
  status: string;
  refundedAmount: number;
  notes: string;
  createdAt: string;
  cashierName: string | null;
  customer: {
    id: number;
    name: string;
    phone: string;
    insuranceProvider: string;
    insuranceNumber: string;
    loyaltyPoints: number;
  } | null;
  prescription: { id: number; code: string; doctorName: string } | null;
  items: {
    id: number;
    productId: number;
    name: string;
    batchNumber: string;
    expiryDate: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    total: number;
    returnedQty: number;
  }[];
  returns: { id: number; returnNo: string; reason: string; refundAmount: number; refundMethod: string; createdAt: string; userName: string | null }[];
};

export function Receipt({ sale, settings }: { sale: SaleDetail; settings: AppSettings }) {
  const money = (n: number) => formatMoney(n, settings);
  // Group batch allocations of the same product into one receipt line.
  const lines = new Map<number, { name: string; quantity: number; unitPrice: number; total: number; discount: number }>();
  for (const i of sale.items) {
    const prev = lines.get(i.productId);
    if (prev) {
      prev.quantity += i.quantity;
      prev.total += i.total;
      prev.discount += i.discount;
    } else lines.set(i.productId, { name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, discount: i.discount });
  }
  return (
    <div className="print-area mx-auto w-full max-w-[320px] bg-white p-5 font-mono text-[11.5px] leading-relaxed text-slate-900">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide">{settings.pharmacyName}</p>
        {settings.legalName && <p>{settings.legalName}</p>}
        {[settings.address, settings.city, settings.country].filter(Boolean).length > 0 && (
          <p>{[settings.address, settings.city, settings.country].filter(Boolean).join(", ")}</p>
        )}
        {settings.phone && <p>Tel: {settings.phone}</p>}
        {settings.taxNumber && (
          <p>
            {settings.taxName} No: {settings.taxNumber}
          </p>
        )}
        {settings.licenseNumber && <p>License: {settings.licenseNumber}</p>}
        {settings.receiptHeader && <p className="mt-1 whitespace-pre-line">{settings.receiptHeader}</p>}
        <p className="mt-2 font-bold">{settings.taxRate > 0 ? "TAX INVOICE" : "RECEIPT"}</p>
      </div>

      <div className="my-2 border-t border-dashed border-slate-400" />
      <Row label="Invoice" value={sale.invoiceNo} />
      <Row label="Date" value={formatDateTime(sale.createdAt, settings.timezone)} />
      {sale.cashierName && <Row label="Served by" value={sale.cashierName} />}
      {sale.customer && <Row label="Patient" value={sale.customer.name} />}
      {sale.prescription && <Row label="Prescription" value={sale.prescription.code} />}
      <div className="my-2 border-t border-dashed border-slate-400" />

      {[...lines.values()].map((l, i) => (
        <div key={i} className="mb-1">
          <p className="font-semibold">{l.name}</p>
          <div className="flex justify-between">
            <span>
              {l.quantity} × {money(l.unitPrice)}
              {l.discount > 0 && ` (−${money(l.discount)})`}
            </span>
            <span>{money(l.total)}</span>
          </div>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-slate-400" />
      <Row label="Subtotal" value={money(sale.subtotal)} />
      {sale.discount > 0 && <Row label="Discount" value={`−${money(sale.discount)}`} />}
      {sale.tax > 0 && (
        <Row
          label={`${settings.taxName} ${settings.taxRate}%${settings.pricesIncludeTax ? " (incl.)" : ""}`}
          value={money(sale.tax)}
        />
      )}
      <Row label="TOTAL" value={money(sale.total)} bold />
      {sale.insuranceAmount > 0 && (
        <Row label={`Insurance${sale.customer?.insuranceProvider ? ` (${sale.customer.insuranceProvider})` : ""}`} value={`−${money(sale.insuranceAmount)}`} />
      )}
      {sale.pointsValue > 0 && <Row label={`Points (${sale.pointsRedeemed})`} value={`−${money(sale.pointsValue)}`} />}
      {(sale.insuranceAmount > 0 || sale.pointsValue > 0) && <Row label="PATIENT PAYS" value={money(sale.amountDue)} bold />}

      <div className="my-2 border-t border-dashed border-slate-400" />
      {sale.cashAmount > 0 && <Row label="Cash" value={money(sale.cashAmount)} />}
      {sale.cardAmount > 0 && <Row label={`Card${sale.paymentReference ? ` (${sale.paymentReference})` : ""}`} value={money(sale.cardAmount)} />}
      {sale.otherAmount > 0 && <Row label="Other" value={money(sale.otherAmount)} />}
      {sale.changeGiven > 0 && <Row label="Change" value={money(sale.changeGiven)} />}
      <Row label="Payment" value={titleCase(sale.paymentMethod)} />
      {sale.refundedAmount > 0 && <Row label="Refunded" value={`−${money(sale.refundedAmount)}`} />}
      {sale.customer && settings.loyaltyEnabled && <Row label="Points balance" value={String(sale.customer.loyaltyPoints)} />}

      <div className="my-2 border-t border-dashed border-slate-400" />
      <p className="whitespace-pre-line text-center">{settings.receiptFooter}</p>
      <p className="mt-2 text-center text-[10px] text-slate-500">Please keep medicines out of reach of children.</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-[13px] font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
