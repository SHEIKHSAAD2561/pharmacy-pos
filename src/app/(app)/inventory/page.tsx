"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes, CalendarX, Download, PackagePlus, Trash2 } from "lucide-react";
import { useSession } from "@/components/session";
import { AdjustBatchModal, ReceiveStockModal, type BatchForAdjust } from "@/components/stock-modals";
import { ExpiryBadge, MovementBadge } from "@/components/status";
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SearchInput, StatCard, Table, Tabs, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

type Batch = {
  id: number;
  productId: number;
  productName: string;
  strength: string;
  dosageForm: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  initialQuantity: number;
  costPrice: number;
  sellPrice: number;
  supplierName: string | null;
  receivedAt: string;
};

type Movement = {
  id: number;
  productId: number;
  productName: string;
  batchNumber: string | null;
  type: string;
  quantity: number;
  reference: string;
  note: string;
  userName: string | null;
  createdAt: string;
};

type View = "instock" | "expiring" | "expired" | "all" | "movements";

export default function InventoryPage() {
  const { money, can, settings } = useSession();
  const [view, setView] = useState<View>("instock");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjust, setAdjust] = useState<BatchForAdjust | null>(null);
  const manage = can("admin", "pharmacist");

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter") as View | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f) setView(f);
  }, []);

  const batches = useApi<Batch[]>(view === "movements" ? null : `/api/inventory/batches?filter=${view}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);
  const movements = useApi<Movement[]>(view === "movements" ? "/api/inventory/movements" : null);
  const expired = useApi<Batch[]>("/api/inventory/batches?filter=expired");
  const expiring = useApi<Batch[]>("/api/inventory/batches?filter=expiring");
  const inStock = useApi<Batch[]>("/api/inventory/batches?filter=instock");

  const reloadAll = () => {
    batches.reload();
    expired.reload();
    expiring.reload();
    inStock.reload();
    if (view === "movements") movements.reload();
  };

  const today = new Date().toISOString().slice(0, 10);
  const sellable = (inStock.data ?? []).filter((b) => b.expiryDate >= today);
  const costValue = sellable.reduce((s, b) => s + b.quantity * b.costPrice, 0);
  const retailValue = sellable.reduce((s, b) => s + b.quantity * b.sellPrice, 0);
  const expiredValue = (expired.data ?? []).reduce((s, b) => s + b.quantity * b.costPrice, 0);
  const expiringValue = (expiring.data ?? []).reduce((s, b) => s + b.quantity * b.costPrice, 0);

  function exportCsv() {
    if (!batches.data) return;
    downloadCsv(
      `stock-${view}.csv`,
      ["Medicine", "Strength", "Batch", "Expiry", "On hand", "Unit cost", "Value", "Supplier"],
      batches.data.map((b) => [b.productName, b.strength, b.batchNumber, b.expiryDate, b.quantity, b.costPrice, (b.quantity * b.costPrice).toFixed(2), b.supplierName ?? ""]),
    );
  }

  const list = movements.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Boxes className="h-5 w-5" />}
        title="Stock & expiry"
        description="Every batch on your shelves, its expiry date and its value."
        actions={
          <>
            {view !== "movements" && (
              <Button variant="outline" onClick={exportCsv} disabled={!batches.data?.length}>
                <Download className="h-4 w-4" /> Export
              </Button>
            )}
            {manage && (
              <Button onClick={() => setReceiveOpen(true)}>
                <PackagePlus className="h-4 w-4" /> Receive stock
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock at cost" value={money(costValue)} icon={<Boxes className="h-5 w-5" />} footer={`${formatNumber(sellable.reduce((s, b) => s + b.quantity, 0))} sellable units`} />
        <StatCard label="Stock at retail" value={money(retailValue)} tone="sky" icon={<Boxes className="h-5 w-5" />} footer={`Potential gross profit ${money(retailValue - costValue)}`} />
        <StatCard
          label={`Expiring in ${settings.expiryAlertDays} days`}
          value={money(expiringValue)}
          tone="amber"
          icon={<CalendarX className="h-5 w-5" />}
          footer={`${expiring.data?.length ?? 0} batches — sell or return to supplier`}
        />
        <StatCard label="Expired, to write off" value={money(expiredValue)} tone="rose" icon={<Trash2 className="h-5 w-5" />} footer={`${expired.data?.length ?? 0} batches blocked from sale`} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<View>
            value={view}
            onChange={setView}
            options={[
              { value: "instock", label: "In stock" },
              { value: "expiring", label: "Expiring soon", count: expiring.data?.length },
              { value: "expired", label: "Expired", count: expired.data?.length },
              { value: "all", label: "All batches" },
              { value: "movements", label: "Movement log" },
            ]}
          />
          {view !== "movements" && <SearchInput value={q} onChange={setQ} placeholder="Medicine or batch…" className="w-full lg:w-72" />}
        </div>

        {view === "movements" ? (
          movements.loading && !movements.data ? (
            <LoadingBlock />
          ) : list.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Medicine</Th>
                  <Th>Batch</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Qty</Th>
                  <Th>Reference</Th>
                  <Th>By</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-slate-500">{formatDateTime(m.createdAt, settings.timezone)}</Td>
                    <Td>
                      <Link href={`/products/${m.productId}`} className="font-medium text-slate-800 hover:text-emerald-700">
                        {m.productName}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{m.batchNumber ?? "—"}</Td>
                    <Td>
                      <MovementBadge type={m.type} />
                    </Td>
                    <Td className={`text-right font-semibold ${m.quantity < 0 ? "text-rose-600" : "text-emerald-600"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
                    <Td className="font-mono text-xs">{m.reference}</Td>
                    <Td>{m.userName ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No stock movements yet" />
          )
        ) : batches.error ? (
          <ErrorBlock message={batches.error} onRetry={batches.reload} />
        ) : batches.loading && !batches.data ? (
          <LoadingBlock />
        ) : batches.data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Medicine</Th>
                <Th>Batch</Th>
                <Th>Expiry</Th>
                <Th className="text-right">On hand</Th>
                <Th className="text-right">Value at cost</Th>
                <Th>Supplier</Th>
                <Th>Received</Th>
                {manage && <Th />}
              </tr>
            </thead>
            <tbody>
              {batches.data.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/products/${b.productId}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                      {b.productName} <span className="font-normal text-slate-500">{b.strength}</span>
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs font-semibold">{b.batchNumber}</Td>
                  <Td>
                    <ExpiryBadge date={b.expiryDate} alertDays={settings.expiryAlertDays} />
                  </Td>
                  <Td className="text-right font-semibold">{b.quantity}</Td>
                  <Td className="text-right">{money(b.quantity * b.costPrice)}</Td>
                  <Td>{b.supplierName ?? "—"}</Td>
                  <Td className="text-slate-500">{formatDate(b.receivedAt, settings.timezone)}</Td>
                  {manage && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant={b.expiryDate < today && b.quantity > 0 ? "danger" : "outline"}
                        onClick={() => setAdjust({ ...b })}
                        disabled={b.quantity === 0 && b.expiryDate < today}
                      >
                        {b.expiryDate < today && b.quantity > 0 ? "Write off" : "Adjust"}
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Boxes className="h-5 w-5" />} title={view === "expired" ? "No expired stock" : view === "expiring" ? "Nothing expiring soon" : "No batches"} />
        )}
      </Card>

      {receiveOpen && <ReceiveStockModal onClose={() => setReceiveOpen(false)} onDone={reloadAll} />}
      {adjust && <AdjustBatchModal batch={adjust} onClose={() => setAdjust(null)} onDone={reloadAll} />}
    </div>
  );
}
