"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, PackagePlus, Pencil, Pill, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductFormModal } from "@/components/product-form";
import { useSession } from "@/components/session";
import { AdjustBatchModal, ReceiveStockModal, type BatchForAdjust } from "@/components/stock-modals";
import { ExpiryBadge, MovementBadge, StockBadge } from "@/components/status";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBlock, LoadingBlock, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Product } from "@/lib/types";

type Detail = Product & {
  batches: { id: number; batchNumber: string; expiryDate: string; quantity: number; initialQuantity: number; costPrice: number; receivedAt: string; supplierName: string | null }[];
  movements: { id: number; type: string; quantity: number; reference: string; note: string; createdAt: string; userName: string | null }[];
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { money, can, settings } = useSession();
  const { data: p, error, loading, reload } = useApi<Detail>(`/api/products/${id}`);
  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjust, setAdjust] = useState<BatchForAdjust | null>(null);
  const manage = can("admin", "pharmacist");

  async function remove() {
    if (!p || !confirm(`Remove ${p.name}? If it has sales history it will be deactivated instead.`)) return;
    try {
      const res = await api<{ deleted: boolean }>(`/api/products/${p.id}`, { method: "DELETE" });
      toast.success(res.deleted ? "Medicine deleted" : "Medicine deactivated (it has history)");
      router.push("/products");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading && !p) return <LoadingBlock />;
  if (error || !p) return <ErrorBlock message={error ?? "Not found"} onRetry={reload} />;

  const stockValue = p.batches.filter((b) => b.quantity > 0 && b.expiryDate >= new Date().toISOString().slice(0, 10)).reduce((s, b) => s + b.quantity * b.costPrice, 0);

  return (
    <div className="space-y-6">
      <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Medicines
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/20">
            <Pill className="h-6 w-6" />
          </div>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              {p.name} <span className="font-medium text-slate-400">{p.strength}</span>
              {p.controlled ? <Badge tone="violet">Controlled</Badge> : p.requiresPrescription && <Badge tone="sky">Prescription only</Badge>}
              {!p.active && <Badge tone="slate">Inactive</Badge>}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {[p.genericName, p.dosageForm, p.packSize, p.manufacturer].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              SKU {p.sku}
              {p.barcode && ` · Barcode ${p.barcode}`}
            </p>
          </div>
        </div>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button onClick={() => setReceiveOpen(true)}>
              <PackagePlus className="h-4 w-4" /> Receive stock
            </Button>
            {can("admin") && (
              <Button variant="ghost" onClick={remove} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Selling price" value={money(p.sellPrice)} sub={p.taxable ? `${settings.taxName} applies` : "Tax exempt"} />
        <Info
          label="Cost price"
          value={money(p.costPrice)}
          sub={p.sellPrice > 0 ? `${(((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(1)}% margin` : undefined}
        />
        <Info label="Sellable stock" value={<StockBadge stock={p.stock} reorderLevel={p.reorderLevel} />} sub={`Reorder at ${p.reorderLevel}`} />
        <Info label="Stock value" value={money(stockValue)} sub={p.shelfLocation ? `Shelf ${p.shelfLocation}` : undefined} />
      </div>

      {(p.description || p.storage) && (
        <Card className="p-5 text-sm text-slate-600">
          {p.storage && (
            <p>
              <b className="text-slate-800">Storage:</b> {p.storage}
            </p>
          )}
          {p.description && <p className="mt-1 whitespace-pre-line">{p.description}</p>}
        </Card>
      )}

      <Card>
        <CardHeader icon={<Boxes className="h-4 w-4" />} title="Batches" description="Sold first-expiry-first-out. Expired batches are never sold." />
        {p.batches.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Batch</Th>
                <Th>Expiry</Th>
                <Th className="text-right">On hand</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Unit cost</Th>
                <Th>Supplier</Th>
                <Th>Received on</Th>
                {manage && <Th />}
              </tr>
            </thead>
            <tbody>
              {p.batches.map((b) => (
                <tr key={b.id} className={b.quantity === 0 ? "opacity-50" : ""}>
                  <Td className="font-mono font-semibold text-slate-800">{b.batchNumber}</Td>
                  <Td>
                    <ExpiryBadge date={b.expiryDate} alertDays={settings.expiryAlertDays} />
                  </Td>
                  <Td className="text-right font-semibold">{b.quantity}</Td>
                  <Td className="text-right text-slate-500">{b.initialQuantity}</Td>
                  <Td className="text-right">{money(b.costPrice)}</Td>
                  <Td>{b.supplierName ?? "—"}</Td>
                  <Td className="text-slate-500">{formatDate(b.receivedAt, settings.timezone)}</Td>
                  {manage && (
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setAdjust({ ...b, productName: p.name })}>
                        Adjust
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No batches yet" description="Receive stock to start selling this medicine." />
        )}
      </Card>

      <Card>
        <CardHeader title="Stock movements" description="Every unit in and out, with who did it." />
        {p.movements.length ? (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th className="text-right">Quantity</Th>
                <Th>Reference</Th>
                <Th>Note</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {p.movements.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-slate-500">{formatDateTime(m.createdAt, settings.timezone)}</Td>
                  <Td>
                    <MovementBadge type={m.type} />
                  </Td>
                  <Td className={`text-right font-semibold ${m.quantity < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </Td>
                  <Td className="font-mono text-xs">{m.reference}</Td>
                  <Td className="text-slate-500">{m.note || "—"}</Td>
                  <Td>{m.userName ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No movements yet" />
        )}
      </Card>

      {editOpen && <ProductFormModal open product={p} onClose={() => setEditOpen(false)} onSaved={() => reload()} />}
      {receiveOpen && <ReceiveStockModal product={p} onClose={() => setReceiveOpen(false)} onDone={reload} />}
      {adjust && <AdjustBatchModal batch={adjust} onClose={() => setAdjust(null)} onDone={reload} />}
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}
