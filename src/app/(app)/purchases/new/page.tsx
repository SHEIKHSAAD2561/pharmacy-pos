"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { ProductPicker } from "@/components/pickers";
import { useSession } from "@/components/session";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import type { Supplier } from "@/lib/types";

type Line = { productId: number; name: string; quantity: number; costPrice: number; stock?: number };
type Suggestion = { productId: number; name: string; strength: string; costPrice: number; stock: number; reorderLevel: number; suggestedQty: number; lastSupplierId: number | null };

export default function NewPurchasePage() {
  const router = useRouter();
  const { money } = useSession();
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  const { data: suggestions } = useApi<Suggestion[]>("/api/purchases/suggestions");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.costPrice, 0);
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;

  function add(l: Line) {
    setLines((prev) => (prev.some((x) => x.productId === l.productId) ? prev : [...prev, l]));
  }

  function addSuggestions() {
    const list = (suggestions ?? []).filter((s) => !supplierId || !s.lastSupplierId || String(s.lastSupplierId) === supplierId);
    list.forEach((s) => add({ productId: s.productId, name: `${s.name} ${s.strength}`.trim(), quantity: s.suggestedQty, costPrice: s.costPrice, stock: s.stock }));
    toast.success(`Added ${list.length} low-stock items`);
  }

  async function save(status: "draft" | "ordered") {
    if (!supplierId) return toast.error("Choose a supplier");
    if (!lines.length) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const po = await api<{ id: number; poNumber: string }>("/api/purchases", {
        body: {
          supplierId: Number(supplierId),
          expectedDate: expectedDate || null,
          notes,
          status,
          taxRate: Number(taxRate) || 0,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, costPrice: l.costPrice })),
        },
      });
      toast.success(`${po.poNumber} created`);
      router.push(`/purchases/${po.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <Link href="/purchases" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Purchase orders
      </Link>
      <PageHeader icon={<ClipboardList className="h-5 w-5" />} title="New purchase order" />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Items"
            action={
              suggestions && suggestions.length > 0 ? (
                <Button size="sm" variant="outline" onClick={addSuggestions}>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Add {suggestions.length} low-stock items
                </Button>
              ) : undefined
            }
          />
          <div className="p-4">
            <ProductPicker onSelect={(p) => add({ productId: p.id, name: `${p.name} ${p.strength}`.trim(), quantity: Math.max(p.reorderLevel * 2 - p.stock, 1), costPrice: p.costPrice, stock: p.stock })} />
          </div>
          {lines.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th className="text-right">In stock</Th>
                  <Th className="w-28">Qty</Th>
                  <Th className="w-32">Unit cost</Th>
                  <Th className="text-right">Line total</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId}>
                    <Td className="font-medium text-slate-900">{l.name}</Td>
                    <Td className="text-right text-slate-500">{l.stock ?? "—"}</Td>
                    <Td>
                      <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x) => (x.productId === l.productId ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} className="h-9" />
                    </Td>
                    <Td>
                      <Input type="number" min={0} step="0.01" value={l.costPrice} onChange={(e) => setLines(lines.map((x) => (x.productId === l.productId ? { ...x, costPrice: Number(e.target.value) || 0 } : x)))} className="h-9" />
                    </Td>
                    <Td className="text-right font-semibold">{money(l.quantity * l.costPrice)}</Td>
                    <Td className="text-right">
                      <button onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No items yet" description="Search for medicines or add all low-stock items at once." />
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Order details" />
          <div className="space-y-4 p-5">
            <Field label="Supplier" required>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose…</option>
                {suppliers?.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected delivery">
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </Field>
            <Field label="Purchase tax (%)">
              <Input type="number" min={0} max={100} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <dl className="space-y-1 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tax</dt>
                <dd>{money(tax)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{money(subtotal + tax)}</dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => save("draft")} loading={busy}>
                Save draft
              </Button>
              <Button onClick={() => save("ordered")} loading={busy}>
                Place order
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </RoleGate>
  );
}
