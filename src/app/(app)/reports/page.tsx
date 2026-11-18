"use client";

import { useState } from "react";
import { BarChart3, Coins, Download, Percent, Receipt, ShoppingBag, TrendingUp, Undo2 } from "lucide-react";
import { RoleGate } from "@/components/app-shell";
import { RevenueArea, SERIES, ShareList, SimpleBars } from "@/components/charts";
import { useSession } from "@/components/session";
import { Button, Card, CardHeader, EmptyState, ErrorBlock, Field, Input, LoadingBlock, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, shiftISO, titleCase, todayLocalISO } from "@/lib/format";

type Report = {
  range: { from: string; to: string };
  summary: Record<string, number>;
  daily: { day: string; revenue: number; orders: number; profit: number }[];
  byCategory: { category: string; revenue: number; quantity: number }[];
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  byCashier: { cashier: string; orders: number; revenue: number }[];
  byHour: { hour: number; orders: number; revenue: number }[];
  inventory: Record<string, number>;
  writeOffs: { type: string; units: number; value: number }[];
};

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
];

export default function ReportsPage() {
  const { money, settings } = useSession();
  const today = todayLocalISO();
  const [from, setFrom] = useState(shiftISO(today, -29));
  const [to, setTo] = useState(today);
  const { data, error, loading, reload } = useApi<Report>(`/api/reports?from=${from}&to=${to}`);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `report-${from}-to-${to}.csv`,
      ["Date", "Orders", "Net sales", "Gross profit"],
      data.daily.map((d) => [d.day, d.orders, d.revenue.toFixed(2), d.profit.toFixed(2)]),
    );
  }

  const s = data?.summary;

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Reports"
        description="Sales, profitability, tax and inventory performance for any period."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" /> Export daily CSV
          </Button>
        }
      />

      <Card className="mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = to === today && from === shiftISO(today, -p.days);
            return (
              <Button
                key={p.label}
                size="sm"
                variant={active ? "dark" : "outline"}
                onClick={() => {
                  setTo(today);
                  setFrom(shiftISO(today, -p.days));
                }}
              >
                {p.label}
              </Button>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFrom(`${today.slice(0, 8)}01`);
              setTo(today);
            }}
          >
            This month
          </Button>
        </div>
        <div className="flex gap-3 lg:ml-auto">
          <Field label="From">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : data && s ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Net sales" value={money(s.total - s.refunds)} icon={<Coins className="h-5 w-5" />} footer={`${formatNumber(s.orders)} orders · avg ${money(s.avg_order)}`} />
            <StatCard label="Gross profit" value={money(s.profit)} tone="violet" icon={<TrendingUp className="h-5 w-5" />} footer={`Cost of goods ${money(s.cost)}`} />
            <StatCard label="Margin" value={`${s.margin.toFixed(1)}%`} tone="teal" icon={<Percent className="h-5 w-5" />} footer={`${formatNumber(s.units)} units sold`} />
            <StatCard label={`${settings.taxName} collected`} value={money(s.tax)} tone="amber" icon={<Receipt className="h-5 w-5" />} footer={`Discounts given ${money(s.discounts)}`} />
          </div>

          <Card>
            <CardHeader title="Daily net sales" description={`${data.range.from} to ${data.range.to}`} />
            <div className="px-3 pb-3 pt-2">
              <RevenueArea data={data.daily} height={280} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Daily gross profit" />
              <div className="px-3 pb-3 pt-2">
                <SimpleBars data={data.daily.map((d) => ({ ...d, label: d.day.slice(5) }))} dataKey="profit" labelKey="label" name="Profit" color={SERIES[6]} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Busiest hours" description="Orders by hour of day" />
              <div className="px-3 pb-3 pt-2">
                <SimpleBars data={data.byHour.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }))} dataKey="orders" labelKey="label" name="Orders" format="number" color={SERIES[0]} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Collections" description="How sales were settled" />
              <div className="p-5">
                <ShareList
                  items={[
                    { label: "Cash", value: s.cash, color: SERIES[0] },
                    { label: "Card", value: s.card, color: SERIES[1] },
                    { label: "Insurance", value: s.insurance, color: SERIES[2] },
                    { label: "Other & points", value: s.other + s.points, color: SERIES[3] },
                  ]}
                />
                <div className="mt-5 flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <span className="flex items-center gap-2">
                    <Undo2 className="h-4 w-4" /> Refunds
                  </span>
                  <b>{money(s.refunds)}</b>
                </div>
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Sales by category" />
              <div className="p-5">
                {data.byCategory.length ? (
                  <ShareList items={data.byCategory.slice(0, 7).map((c, i) => ({ label: c.category, value: c.revenue, color: SERIES[i] })).concat(
                    data.byCategory.length > 7 ? [{ label: "Other", value: data.byCategory.slice(7).reduce((a, c) => a + c.revenue, 0), color: "#94a3b8" }] : [],
                  )} />
                ) : (
                  <EmptyState title="No sales in this period" />
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader title="Top medicines" icon={<ShoppingBag className="h-4 w-4" />} />
              <Table>
                <thead>
                  <tr>
                    <Th>Medicine</Th>
                    <Th className="text-right">Units</Th>
                    <Th className="text-right">Sales</Th>
                    <Th className="text-right">Profit</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.name}>
                      <Td className="font-medium text-slate-900">{p.name}</Td>
                      <Td className="text-right">{formatNumber(p.quantity)}</Td>
                      <Td className="text-right">{money(p.revenue)}</Td>
                      <Td className="text-right font-semibold text-emerald-700">{money(p.profit)}</Td>
                    </tr>
                  ))}
                  {!data.topProducts.length && (
                    <tr>
                      <Td colSpan={4} className="text-center text-slate-500">
                        No sales in this period
                      </Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Staff performance" />
                <Table>
                  <thead>
                    <tr>
                      <Th>Staff</Th>
                      <Th className="text-right">Orders</Th>
                      <Th className="text-right">Sales</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCashier.map((c) => (
                      <tr key={c.cashier}>
                        <Td className="font-medium">{c.cashier}</Td>
                        <Td className="text-right">{c.orders}</Td>
                        <Td className="text-right font-semibold">{money(c.revenue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Inventory today</h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row label="Units on hand" value={formatNumber(data.inventory.units)} />
                  <Row label="Value at cost" value={money(data.inventory.cost_value)} />
                  <Row label="Value at retail" value={money(data.inventory.retail_value)} />
                  <Row label="Expired, not written off" value={money(data.inventory.expired_value)} danger={data.inventory.expired_value > 0} />
                  {data.writeOffs.map((w) => (
                    <Row key={w.type} label={`Written off (${titleCase(w.type)}) in period`} value={`${w.units} units · ${money(w.value)}`} />
                  ))}
                </dl>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </RoleGate>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={danger ? "font-semibold text-rose-600" : "font-medium text-slate-800"}>{value}</dd>
    </div>
  );
}
