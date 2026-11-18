"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Pill, Plus } from "lucide-react";
import { ProductFormModal } from "@/components/product-form";
import { useSession } from "@/components/session";
import { ExpiryBadge, StockBadge } from "@/components/status";
import { Badge, Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SearchInput, Select, Table, Tabs, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import type { Category, Product } from "@/lib/types";

type Status = "active" | "low" | "out" | "expiring" | "expired" | "inactive";

export default function ProductsPage() {
  const { money, can, settings } = useSession();
  const [status, setStatus] = useState<Status>("active");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const dq = useDebounced(q);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status") as Status | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setStatus(s);
  }, []);

  const url = `/api/products?status=${status}${dq ? `&q=${encodeURIComponent(dq)}` : ""}${categoryId ? `&categoryId=${categoryId}` : ""}`;
  const { data, error, loading, reload } = useApi<Product[]>(url);
  const { data: categories } = useApi<Category[]>("/api/categories");

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      "medicines.csv",
      ["Name", "Generic", "Strength", "Form", "Category", "SKU", "Barcode", "Sell price", "Cost price", "Stock", "Reorder level", "Next expiry", "Rx", "Controlled"],
      data.map((p) => [p.name, p.genericName, p.strength, p.dosageForm, p.categoryName ?? "", p.sku, p.barcode ?? "", p.sellPrice, p.costPrice, p.stock, p.reorderLevel, p.nextExpiry ?? "", p.requiresPrescription ? "Yes" : "No", p.controlled ? "Yes" : "No"]),
    );
  }

  return (
    <div>
      <PageHeader
        icon={<Pill className="h-5 w-5" />}
        title="Medicines"
        description="Your catalog of medicines and products, with live stock and expiry."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {can("admin", "pharmacist") && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Add medicine
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <Tabs<Status>
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "All active" },
              { value: "low", label: "Low stock" },
              { value: "out", label: "Out of stock" },
              { value: "expiring", label: "Expiring" },
              { value: "expired", label: "Has expired stock" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <div className="flex flex-1 gap-3 lg:justify-end">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-48">
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <SearchInput value={q} onChange={setQ} className="w-full max-w-xs" placeholder="Name, generic, SKU, barcode…" />
          </div>
        </div>

        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Medicine</Th>
                <Th>Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Margin</Th>
                <Th>Stock</Th>
                <Th>Next expiry</Th>
                <Th>Shelf</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/products/${p.id}`} className="group block">
                      <span className="flex items-center gap-2 font-semibold text-slate-900 group-hover:text-emerald-700">
                        {p.name} <span className="font-normal text-slate-500">{p.strength}</span>
                        {p.controlled ? <Badge tone="violet">CD</Badge> : p.requiresPrescription && <Badge tone="sky">Rx</Badge>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {[p.genericName, p.dosageForm, p.packSize].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </Td>
                  <Td>{p.categoryName ? <Badge tone={p.categoryColor ?? "slate"}>{p.categoryName}</Badge> : <span className="text-slate-400">—</span>}</Td>
                  <Td className="text-right font-semibold text-slate-900">{money(p.sellPrice)}</Td>
                  <Td className="text-right text-slate-500">{p.sellPrice > 0 ? `${(((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0)}%` : "—"}</Td>
                  <Td className="whitespace-nowrap">
                    <StockBadge stock={p.stock} reorderLevel={p.reorderLevel} />
                    {p.expiredStock > 0 && <span className="ml-1.5 text-xs font-medium text-rose-600">+{p.expiredStock} expired</span>}
                  </Td>
                  <Td>
                    <ExpiryBadge date={p.nextExpiry} alertDays={settings.expiryAlertDays} />
                  </Td>
                  <Td className="text-slate-500">{p.shelfLocation || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Pill className="h-5 w-5" />} title="No medicines here" description="Try a different filter, or add your first medicine." />
        )}
        {data && data.length > 0 && <p className="px-4 py-3 text-xs text-slate-500">{data.length} medicines</p>}
      </Card>

      {formOpen && <ProductFormModal open onClose={() => setFormOpen(false)} onSaved={() => reload()} />}
    </div>
  );
}
