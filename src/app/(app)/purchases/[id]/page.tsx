"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, PackageCheck, Printer, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { PoStatus } from "@/components/status";
import { Button, Card, CardHeader, ErrorBlock, Input, LoadingBlock, Modal, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Supplier } from "@/lib/types";

type Po = {
  id: number;
  poNumber: string;
  status: string;
  expectedDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  createdAt: string;
  receivedAt: string | null;
  createdByName: string | null;
  supplier: Supplier;
  items: { id: number; productId: number; productName: string; strength: string; dosageForm: string; sku: string; quantity: number; costPrice: number; receivedQty: number }[];
};

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { money, settings } = useSession();
  const { data: po, error, loading, reload } = useApi<Po>(`/api/purchases/${id}`);
  const [receiveOpen, setReceiveOpen] = useState(false);

  async function setStatus(status: "ordered" | "cancelled") {
    if (status === "cancelled" && !confirm("Cancel this purchase order?")) return;
    try {
      await api(`/api/purchases/${id}`, { method: "PATCH", body: { status } });
      toast.success(status === "ordered" ? "Order placed" : "Order cancelled");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    if (!confirm("Delete this draft?")) return;
    try {
      await api(`/api/purchases/${id}`, { method: "DELETE" });
      router.push("/purchases");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading && !po) return <LoadingBlock />;
  if (error || !po) return <ErrorBlock message={error ?? "Not found"} onRetry={reload} />;
  const open = ["draft", "ordered", "partially_received"].includes(po.status);

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <div className="space-y-6">
        <Link href="/purchases" className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Purchase orders
        </Link>
        <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
              {po.poNumber} <PoStatus status={po.status} />
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {po.supplier.name} · created {formatDateTime(po.createdAt, settings.timezone)}
              {po.createdByName && ` by ${po.createdByName}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {po.status === "draft" && (
              <>
                <Button variant="ghost" onClick={remove}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <Button variant="dark" onClick={() => setStatus("ordered")}>
                  <Send className="h-4 w-4" /> Place order
                </Button>
              </>
            )}
            {po.status === "ordered" && (
              <Button variant="ghost" onClick={() => setStatus("cancelled")}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
            )}
            {open && po.status !== "draft" && (
              <Button onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="h-4 w-4" /> Receive delivery
              </Button>
            )}
          </div>
        </div>

        <Card className="print-area">
          <div className="grid gap-6 border-b border-slate-100 p-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p>
              <p className="mt-1 font-semibold text-slate-900">{settings.pharmacyName}</p>
              <p className="text-sm text-slate-600">{[settings.address, settings.city].filter(Boolean).join(", ")}</p>
              <p className="text-sm text-slate-600">{settings.phone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</p>
              <p className="mt-1 font-semibold text-slate-900">{po.supplier.name}</p>
              <p className="text-sm text-slate-600">{po.supplier.contactPerson}</p>
              <p className="text-sm text-slate-600">{[po.supplier.phone, po.supplier.email].filter(Boolean).join(" · ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order</p>
              <p className="mt-1 font-semibold text-slate-900">{po.poNumber}</p>
              <p className="text-sm text-slate-600">Expected {formatDate(po.expectedDate)}</p>
              {po.receivedAt && <p className="text-sm text-slate-600">Received {formatDate(po.receivedAt, settings.timezone)}</p>}
            </div>
          </div>
          <CardHeader title="Items" />
          <Table>
            <thead>
              <tr>
                <Th>Medicine</Th>
                <Th>SKU</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Unit cost</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <span className="font-medium text-slate-900">
                      {i.productName} {i.strength}
                    </span>
                    <span className="block text-xs text-slate-500">{i.dosageForm}</span>
                  </Td>
                  <Td className="font-mono text-xs">{i.sku}</Td>
                  <Td className="text-right">{i.quantity}</Td>
                  <Td className={`text-right font-semibold ${i.receivedQty >= i.quantity ? "text-emerald-600" : i.receivedQty > 0 ? "text-amber-600" : "text-slate-400"}`}>{i.receivedQty}</Td>
                  <Td className="text-right">{money(i.costPrice)}</Td>
                  <Td className="text-right font-semibold">{money(i.quantity * i.costPrice)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex justify-end p-6">
            <dl className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{money(po.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tax</dt>
                <dd>{money(po.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{money(po.total)}</dd>
              </div>
            </dl>
          </div>
          {po.notes && <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">Notes: {po.notes}</p>}
        </Card>
      </div>
      {receiveOpen && <ReceiveModal po={po} onClose={() => setReceiveOpen(false)} onDone={reload} />}
    </RoleGate>
  );
}

function ReceiveModal({ po, onClose, onDone }: { po: Po; onClose: () => void; onDone: () => void }) {
  const outstanding = po.items.filter((i) => i.receivedQty < i.quantity);
  const [rows, setRows] = useState(
    Object.fromEntries(outstanding.map((i) => [i.id, { quantity: String(i.quantity - i.receivedQty), batchNumber: "", expiryDate: "", costPrice: String(i.costPrice) }])),
  );
  const [busy, setBusy] = useState(false);
  const update = (id: number, k: string, v: string) => setRows({ ...rows, [id]: { ...rows[id], [k]: v } });

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/purchases/${po.id}/receive`, {
        body: {
          items: outstanding.map((i) => ({
            itemId: i.id,
            quantity: Number(rows[i.id].quantity) || 0,
            batchNumber: rows[i.id].batchNumber,
            expiryDate: rows[i.id].expiryDate,
            costPrice: Number(rows[i.id].costPrice),
          })),
        },
      });
      toast.success("Delivery received into stock");
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
      size="xl"
      title={`Receive delivery for ${po.poNumber}`}
      description="Enter the batch number and expiry printed on each pack. Set quantity to 0 for items not delivered."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            <PackageCheck className="h-4 w-4" /> Receive into stock
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {outstanding.map((i) => (
          <div key={i.id} className="grid items-end gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1.4fr_90px_1fr_1fr_110px]">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {i.productName} {i.strength}
              </p>
              <p className="text-xs text-slate-500">{i.quantity - i.receivedQty} outstanding</p>
            </div>
            <label className="text-xs font-semibold text-slate-600">
              Qty
              <Input type="number" min={0} max={i.quantity - i.receivedQty} value={rows[i.id].quantity} onChange={(e) => update(i.id, "quantity", e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Batch no.
              <Input value={rows[i.id].batchNumber} onChange={(e) => update(i.id, "batchNumber", e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Expiry
              <Input type="date" value={rows[i.id].expiryDate} onChange={(e) => update(i.id, "expiryDate", e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Unit cost
              <Input type="number" min={0} step="0.01" value={rows[i.id].costPrice} onChange={(e) => update(i.id, "costPrice", e.target.value)} className="mt-1 h-9" />
            </label>
          </div>
        ))}
      </div>
    </Modal>
  );
}
