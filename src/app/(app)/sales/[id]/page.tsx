"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Printer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Receipt, type SaleDetail } from "@/components/receipt";
import { useSession } from "@/components/session";
import { SaleStatus } from "@/components/status";
import { Button, Card, CardHeader, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, Switch, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { money, settings, can } = useSession();
  const { data: sale, error, loading, reload } = useApi<SaleDetail>(`/api/sales/${id}`);
  const [returnOpen, setReturnOpen] = useState(false);

  if (loading && !sale) return <LoadingBlock />;
  if (error || !sale) return <ErrorBlock message={error ?? "Not found"} onRetry={reload} />;

  const returnable = sale.items.some((i) => i.quantity > i.returnedQty);

  return (
    <div className="space-y-6">
      <Link href="/sales" className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Sales history
      </Link>

      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            {sale.invoiceNo} <SaleStatus status={sale.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(sale.createdAt, settings.timezone)} · by {sale.cashierName ?? "—"}
            {sale.customer && (
              <>
                {" · "}
                <Link href={`/customers/${sale.customer.id}`} className="font-medium text-emerald-700 hover:underline">
                  {sale.customer.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
          {can("admin", "pharmacist") && returnable && (
            <Button variant="dark" onClick={() => setReturnOpen(true)}>
              <Undo2 className="h-4 w-4" /> Return items
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="no-print space-y-6">
          <Card>
            <CardHeader title="Items" description="Each line shows the exact batch that was dispensed." />
            <Table>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Batch</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Discount</Th>
                  <Th className="text-right">{settings.taxName}</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <Link href={`/products/${i.productId}`} className="font-medium text-slate-900 hover:text-emerald-700">
                        {i.name}
                      </Link>
                      {i.returnedQty > 0 && <span className="block text-xs text-rose-600">{i.returnedQty} returned</span>}
                    </Td>
                    <Td className="font-mono text-xs">
                      {i.batchNumber}
                      {i.expiryDate && <span className="block text-slate-400">exp {formatDate(i.expiryDate)}</span>}
                    </Td>
                    <Td className="text-right">{i.quantity}</Td>
                    <Td className="text-right">{money(i.unitPrice)}</Td>
                    <Td className="text-right">{i.discount > 0 ? `−${money(i.discount)}` : "—"}</Td>
                    <Td className="text-right">{money(i.tax)}</Td>
                    <Td className="text-right font-semibold">{money(i.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">Payment</h3>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Total" value={money(sale.total)} />
                {sale.insuranceAmount > 0 && <Row label={`Insurance (${sale.customer?.insuranceProvider ?? ""})`} value={money(sale.insuranceAmount)} />}
                {sale.pointsValue > 0 && <Row label={`Points (${sale.pointsRedeemed})`} value={money(sale.pointsValue)} />}
                <Row label="Patient paid" value={money(sale.amountDue)} bold />
                {sale.cashAmount > 0 && <Row label="Cash tendered" value={money(sale.cashAmount)} />}
                {sale.cardAmount > 0 && <Row label="Card" value={money(sale.cardAmount)} />}
                {sale.otherAmount > 0 && <Row label="Other" value={money(sale.otherAmount)} />}
                {sale.changeGiven > 0 && <Row label="Change" value={money(sale.changeGiven)} />}
                {sale.paymentReference && <Row label="Reference" value={sale.paymentReference} />}
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">Details</h3>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Method" value={titleCase(sale.paymentMethod)} />
                {sale.prescription && (
                  <Row
                    label="Prescription"
                    value={
                      <Link href={`/prescriptions/${sale.prescription.id}`} className="font-semibold text-emerald-700 hover:underline">
                        {sale.prescription.code}
                      </Link>
                    }
                  />
                )}
                {sale.notes && <Row label="Note" value={sale.notes} />}
                <Row label="Refunded" value={money(sale.refundedAmount)} />
              </dl>
            </Card>
          </div>

          {sale.returns.length > 0 && (
            <Card>
              <CardHeader title="Returns" />
              <Table>
                <thead>
                  <tr>
                    <Th>Return</Th>
                    <Th>Date</Th>
                    <Th>Reason</Th>
                    <Th>By</Th>
                    <Th className="text-right">Refund</Th>
                  </tr>
                </thead>
                <tbody>
                  {sale.returns.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-semibold">{r.returnNo}</Td>
                      <Td className="text-slate-500">{formatDateTime(r.createdAt, settings.timezone)}</Td>
                      <Td>{r.reason}</Td>
                      <Td>{r.userName ?? "—"}</Td>
                      <Td className="text-right font-semibold text-rose-600">
                        −{money(r.refundAmount)} <span className="text-xs font-normal text-slate-500">({r.refundMethod})</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <Card className="h-fit bg-slate-50 p-2">
          <Receipt sale={sale} settings={settings} />
        </Card>
      </div>

      {returnOpen && <ReturnModal sale={sale} onClose={() => setReturnOpen(false)} onDone={reload} />}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={bold ? "font-bold text-slate-900" : "font-medium text-slate-800"}>{value}</dd>
    </div>
  );
}

function ReturnModal({ sale, onClose, onDone }: { sale: SaleDetail; onClose: () => void; onDone: () => void }) {
  const { money } = useSession();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [restock, setRestock] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(sale.cardAmount > 0 && sale.cashAmount === 0 ? "card" : "cash");
  const [busy, setBusy] = useState(false);
  const ratio = sale.total > 0 ? sale.amountDue / sale.total : 0;
  const estimate = sale.items.reduce((s, i) => s + ((qty[i.id] ?? 0) * i.total * ratio) / i.quantity, 0);

  async function submit() {
    const items = sale.items
      .filter((i) => (qty[i.id] ?? 0) > 0)
      .map((i) => ({ saleItemId: i.id, quantity: qty[i.id], restock: restock[i.id] ?? true }));
    if (!items.length) return toast.error("Choose at least one item to return");
    setBusy(true);
    try {
      const r = await api<{ returnNo: string; refundAmount: number }>(`/api/sales/${sale.id}/returns`, { body: { items, reason, refundMethod: method } });
      toast.success(`${r.returnNo}: refund ${money(r.refundAmount)}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Return items from ${sale.invoiceNo}`}
      description="Restocked items go back into the original batch. Damaged or opened items should not be restocked."
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-600">
            Refund: <b className="text-slate-900">{money(estimate)}</b>
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason.trim()}>
            Process return
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {sale.items.map((i) => {
          const max = i.quantity - i.returnedQty;
          return (
            <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{i.name}</p>
                <p className="text-xs text-slate-500">
                  Batch {i.batchNumber} · {max} of {i.quantity} returnable
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={max}
                disabled={max === 0}
                value={qty[i.id] ?? ""}
                onChange={(e) => setQty({ ...qty, [i.id]: Math.min(max, Math.max(0, Number(e.target.value) || 0)) })}
                className="w-20"
                placeholder="0"
              />
              <Switch checked={restock[i.id] ?? true} onChange={(v) => setRestock({ ...restock, [i.id]: v })} label="Restock" />
            </div>
          );
        })}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reason" required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong item, adverse reaction" />
          </Field>
          <Field label="Refund method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        {sale.insuranceAmount > 0 && (
          <p className="text-xs text-slate-500">Only the share the patient paid is refunded. Adjust the insurance claim separately.</p>
        )}
      </div>
    </Modal>
  );
}
