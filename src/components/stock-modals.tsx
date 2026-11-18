"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, useApi } from "@/lib/client/api";
import type { Product, Supplier } from "@/lib/types";
import { ProductPicker } from "./pickers";
import { Button, Field, Input, Modal, Select } from "./ui";

export function ReceiveStockModal({
  product,
  onClose,
  onDone,
}: {
  product?: Pick<Product, "id" | "name" | "strength" | "costPrice"> | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(product ?? null);
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  const [form, setForm] = useState({
    batchNumber: "",
    expiryDate: "",
    quantity: "",
    costPrice: product ? String(product.costPrice) : "",
    supplierId: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return toast.error("Choose a medicine");
    setBusy(true);
    try {
      await api("/api/inventory/batches", {
        body: {
          productId: selected.id,
          batchNumber: form.batchNumber,
          expiryDate: form.expiryDate,
          quantity: Number(form.quantity),
          costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
          supplierId: form.supplierId ? Number(form.supplierId) : null,
          note: form.note,
        },
      });
      toast.success(`Received ${form.quantity} × ${selected.name}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Receive stock"
      description="Add a new batch with its lot number and expiry date."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="receive-form" loading={busy}>
            Receive
          </Button>
        </>
      }
    >
      <form id="receive-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {selected ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-inset ring-emerald-200">
              <span className="text-sm font-semibold text-slate-900">
                {selected.name} <span className="font-normal text-slate-500">{selected.strength}</span>
              </span>
              {!product && (
                <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-slate-500 hover:text-rose-600">
                  Change
                </button>
              )}
            </div>
          ) : (
            <ProductPicker
              onSelect={(p) => {
                setSelected(p);
                setForm((f) => ({ ...f, costPrice: String(p.costPrice) }));
              }}
            />
          )}
        </div>
        <Field label="Batch / lot number" required>
          <Input required value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
        </Field>
        <Field label="Expiry date" required>
          <Input required type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </Field>
        <Field label="Quantity" required>
          <Input required type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
        <Field label="Unit cost">
          <Input type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
        </Field>
        <Field label="Supplier" className="sm:col-span-2">
          <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">—</option>
            {suppliers?.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Invoice number, delivery note…" />
        </Field>
      </form>
    </Modal>
  );
}

export type BatchForAdjust = { id: number; batchNumber: string; quantity: number; productName?: string; expiryDate: string };

export function AdjustBatchModal({ batch, onClose, onDone }: { batch: BatchForAdjust; onClose: () => void; onDone: () => void }) {
  const expired = batch.expiryDate < new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<"adjustment" | "expired" | "damaged">(expired ? "expired" : "adjustment");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [qty, setQty] = useState(expired ? String(batch.quantity) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!n) return toast.error("Enter a quantity");
    setBusy(true);
    try {
      const change = type === "adjustment" && direction === "add" ? n : -n;
      await api("/api/inventory/adjust", { body: { batchId: batch.id, quantityChange: change, type, note } });
      toast.success("Stock updated");
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Adjust batch"
      description={`${batch.productName ? `${batch.productName} · ` : ""}Batch ${batch.batchNumber} · ${batch.quantity} units on hand`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" loading={busy} variant={type === "adjustment" ? "primary" : "danger"}>
            {type === "adjustment" ? "Save adjustment" : "Write off"}
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={save} className="space-y-4">
        <Field label="Reason">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="adjustment">Stock count correction</option>
            <option value="expired">Write off: expired</option>
            <option value="damaged">Write off: damaged / lost</option>
          </Select>
        </Field>
        {type === "adjustment" && (
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="remove">Remove units (counted fewer)</option>
              <option value="add">Add units (counted more)</option>
            </Select>
          </Field>
        )}
        <Field label="Quantity">
          <Input type="number" min={1} max={type === "adjustment" && direction === "add" ? undefined : batch.quantity} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
      </form>
    </Modal>
  );
}
