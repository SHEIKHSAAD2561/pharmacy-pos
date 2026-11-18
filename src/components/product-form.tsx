"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, useApi } from "@/lib/client/api";
import type { Category, Product } from "@/lib/types";
import { useSession } from "./session";
import { Button, Field, Input, Modal, Select, Switch, Textarea } from "./ui";

const FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Injection", "Injection pen", "Cream", "Ointment", "Gel", "Drops", "Eye drops", "Inhaler", "Nasal spray", "Sachet", "Suppository", "Patch", "Lotion", "Device", "Other"];

export function ProductFormModal({
  open,
  onClose,
  product,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved: (p: { id: number }) => void;
}) {
  const { money, can } = useSession();
  const { data: categories, reload: reloadCategories } = useApi<Category[]>("/api/categories");
  const [form, setForm] = useState({
    name: product?.name ?? "",
    genericName: product?.genericName ?? "",
    brand: product?.brand ?? "",
    manufacturer: product?.manufacturer ?? "",
    categoryId: product?.categoryId ? String(product.categoryId) : "",
    dosageForm: product?.dosageForm ?? "Tablet",
    strength: product?.strength ?? "",
    packSize: product?.packSize ?? "",
    unit: product?.unit ?? "pack",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    description: product?.description ?? "",
    sellPrice: product ? String(product.sellPrice) : "",
    costPrice: product ? String(product.costPrice) : "",
    taxable: product?.taxable ?? true,
    requiresPrescription: product?.requiresPrescription ?? false,
    controlled: product?.controlled ?? false,
    reorderLevel: product ? String(product.reorderLevel) : "10",
    shelfLocation: product?.shelfLocation ?? "",
    storage: product?.storage ?? "",
    active: product?.active ?? true,
  });
  const [opening, setOpening] = useState({ batchNumber: "", expiryDate: "", quantity: "" });
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const sell = Number(form.sellPrice) || 0;
  const cost = Number(form.costPrice) || 0;
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      const c = await api<Category>("/api/categories", { body: { name: newCategory.trim() } });
      await reloadCategories();
      set("categoryId", String(c.id));
      setNewCategory("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        sellPrice: sell,
        costPrice: cost,
        reorderLevel: Number(form.reorderLevel) || 0,
        barcode: form.barcode || null,
        ...(!product && opening.batchNumber && opening.expiryDate && Number(opening.quantity) > 0
          ? { openingStock: { batchNumber: opening.batchNumber, expiryDate: opening.expiryDate, quantity: Number(opening.quantity) } }
          : {}),
      };
      const saved = product
        ? await api<{ id: number }>(`/api/products/${product.id}`, { method: "PUT", body: payload })
        : await api<{ id: number }>("/api/products", { body: payload });
      toast.success(product ? "Medicine updated" : "Medicine added");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={product ? `Edit ${product.name}` : "Add medicine"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={busy}>
            Save medicine
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={save} className="space-y-6">
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Identity</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Brand / trade name" required className="lg:col-span-2">
              <Input required autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Panadol" />
            </Field>
            <Field label="Generic name (INN)">
              <Input value={form.genericName} onChange={(e) => set("genericName", e.target.value)} placeholder="e.g. Paracetamol" />
            </Field>
            <Field label="Dosage form">
              <Select value={form.dosageForm} onChange={(e) => set("dosageForm", e.target.value)}>
                {FORMS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
            </Field>
            <Field label="Strength">
              <Input value={form.strength} onChange={(e) => set("strength", e.target.value)} placeholder="500 mg" />
            </Field>
            <Field label="Pack size">
              <Input value={form.packSize} onChange={(e) => set("packSize", e.target.value)} placeholder="24 tablets" />
            </Field>
            <Field label="Manufacturer">
              <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
            </Field>
            <Field label="Category">
              <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Uncategorized</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="New category">
              <div className="flex gap-2">
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Add a category" />
                <Button type="button" variant="outline" onClick={addCategory}>
                  Add
                </Button>
              </div>
            </Field>
            <Field label="Barcode (EAN/UPC)">
              <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className="font-mono" />
            </Field>
            <Field label="SKU" hint="Leave empty to generate one">
              <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
            </Field>
            <Field label="Selling unit">
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="pack, bottle, piece" />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Pricing & stock rules</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Selling price" required>
              <Input required type="number" step="0.01" min={0} value={form.sellPrice} onChange={(e) => set("sellPrice", e.target.value)} />
            </Field>
            <Field label="Cost price" hint={sell > 0 ? `Margin ${margin.toFixed(1)}% · profit ${money(sell - cost)}` : undefined}>
              <Input type="number" step="0.01" min={0} value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
            </Field>
            <Field label="Reorder level">
              <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} />
            </Field>
            <Field label="Shelf location">
              <Input value={form.shelfLocation} onChange={(e) => set("shelfLocation", e.target.value)} placeholder="A1, Fridge 2…" />
            </Field>
            <Field label="Storage conditions" className="sm:col-span-2">
              <Input value={form.storage} onChange={(e) => set("storage", e.target.value)} placeholder="Store below 25 °C" />
            </Field>
            <Field label="Description / counselling notes" className="sm:col-span-2">
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-[42px]" />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <Switch checked={form.taxable} onChange={(v) => set("taxable", v)} label="Taxable" description="Apply the pharmacy tax rate at checkout." />
            <Switch
              checked={form.requiresPrescription || form.controlled}
              onChange={(v) => set("requiresPrescription", v)}
              disabled={form.controlled}
              label="Prescription only (Rx)"
              description="A prescription must be attached to sell it."
            />
            <Switch
              checked={form.controlled}
              onChange={(v) => set("controlled", v)}
              label="Controlled drug"
              description="Only pharmacists can dispense; always requires a prescription."
            />
            <Switch checked={form.active} onChange={(v) => set("active", v)} label="Active" description="Inactive medicines are hidden from the POS." />
          </div>
        </section>

        {!product && can("admin", "pharmacist") && (
          <section>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Opening stock (optional)</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Batch / lot number">
                <Input value={opening.batchNumber} onChange={(e) => setOpening({ ...opening, batchNumber: e.target.value })} />
              </Field>
              <Field label="Expiry date">
                <Input type="date" value={opening.expiryDate} onChange={(e) => setOpening({ ...opening, expiryDate: e.target.value })} />
              </Field>
              <Field label="Quantity">
                <Input type="number" min={0} value={opening.quantity} onChange={(e) => setOpening({ ...opening, quantity: e.target.value })} />
              </Field>
            </div>
          </section>
        )}
      </form>
    </Modal>
  );
}
