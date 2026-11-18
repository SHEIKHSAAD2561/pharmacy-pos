"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  FileText,
  LayoutDashboard,
  PackageX,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { RevenueArea, SERIES, ShareList } from "@/components/charts";
import { useSession } from "@/components/session";
import { SaleStatus } from "@/components/status";
import { Badge, Card, CardHeader, EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { daysUntil, formatDate, formatDateTime, formatNumber } from "@/lib/format";

type Dashboard = {
  kpis: Record<string, number>;
  stock: Record<string, number>;
  series: { day: string; revenue: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  payments: { method: string; amount: number }[];
  recentSales: { id: number; invoiceNo: string; total: number; status: string; paymentMethod: string; createdAt: string; customerName: string | null }[];
  lowStock: { id: number; name: string; strength: string; stock: number; reorderLevel: number }[];
  expiring: { id: number; name: string; strength: string; batchNumber: string; expiryDate: string; quantity: number }[];
};

export default function DashboardPage() {
  const { user, settings, money } = useSession();
  const { data, error, loading, reload } = useApi<Dashboard>("/api/dashboard");

  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: settings.timezone || undefined }),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Could not load dashboard"} onRetry={reload} />;

  const { kpis, stock } = data;
  const change = kpis.yesterday_revenue > 0 ? ((kpis.today_revenue - kpis.yesterday_revenue) / kpis.yesterday_revenue) * 100 : null;
  const avgBasket = kpis.today_count ? kpis.today_revenue / kpis.today_count : 0;
  const twoWeekTotal = data.series.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={`Here is what is happening at ${settings.pharmacyName} today.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={money(kpis.today_revenue)}
          icon={<Wallet className="h-5 w-5" />}
          footer={
            change === null ? (
              "No sales yesterday to compare"
            ) : (
              <span className={change >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {change >= 0 ? <ArrowUpRight className="inline h-3.5 w-3.5" /> : <ArrowDownRight className="inline h-3.5 w-3.5" />}
                {Math.abs(change).toFixed(1)}% vs yesterday
              </span>
            )
          }
        />
        <StatCard
          label="Transactions"
          value={formatNumber(kpis.today_count)}
          tone="sky"
          icon={<ShoppingBag className="h-5 w-5" />}
          footer={`Average basket ${money(avgBasket)}`}
        />
        <StatCard
          label="Today's gross profit"
          value={money(kpis.today_profit)}
          tone="violet"
          icon={<TrendingUp className="h-5 w-5" />}
          footer={`Month to date ${money(kpis.month_revenue)} in sales`}
        />
        <StatCard
          label="Stock value (cost)"
          value={money(stock.stock_value)}
          tone="amber"
          icon={<Boxes className="h-5 w-5" />}
          footer={`${formatNumber(stock.product_count)} active medicines`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AlertTile href="/products?status=low" icon={<AlertTriangle className="h-4 w-4" />} tone="amber" label="Low stock" value={stock.low_stock} />
        <AlertTile href="/products?status=out" icon={<PackageX className="h-4 w-4" />} tone="rose" label="Out of stock" value={stock.out_of_stock} />
        <AlertTile
          href="/inventory?filter=expiring"
          icon={<CalendarClock className="h-4 w-4" />}
          tone="amber"
          label={`Batches expiring in ${settings.expiryAlertDays} days`}
          value={stock.expiring_batches}
        />
        <AlertTile href="/prescriptions?status=pending" icon={<FileText className="h-4 w-4" />} tone="sky" label="Prescriptions to dispense" value={stock.pending_prescriptions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sales, last 14 days" description={`${money(twoWeekTotal)} net of refunds`} />
          <div className="px-3 pb-3 pt-2">
            <RevenueArea data={data.series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments, last 30 days" description="How customers paid" />
          <div className="p-5">
            <ShareList items={data.payments.map((p, i) => ({ label: p.method, value: p.amount, color: SERIES[i] }))} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Best sellers" description="Units sold, last 30 days" />
          {data.topProducts.length ? (
            <ul className="divide-y divide-slate-100">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-slate-900">{formatNumber(p.quantity)} units</span>
                    <span className="block text-xs text-slate-500">{money(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sales yet" description="Best sellers will show up here." />
          )}
        </Card>

        <Card>
          <CardHeader title="Needs reordering" action={<Link href="/purchases/new" className="text-xs font-semibold text-emerald-600 hover:underline">Create order</Link>} />
          {data.lowStock.length ? (
            <ul className="divide-y divide-slate-100">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/products/${p.id}`} className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-emerald-700">
                    {p.name} <span className="text-slate-500">{p.strength}</span>
                  </Link>
                  <Badge tone={p.stock === 0 ? "rose" : "amber"}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Stock levels are healthy" />
          )}
        </Card>

        <Card>
          <CardHeader title="Expiring soon" action={<Link href="/inventory?filter=expiring" className="text-xs font-semibold text-emerald-600 hover:underline">View all</Link>} />
          {data.expiring.length ? (
            <ul className="divide-y divide-slate-100">
              {data.expiring.map((b) => {
                const days = daysUntil(b.expiryDate) ?? 0;
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-500">
                        Batch {b.batchNumber} · {b.quantity} units
                      </p>
                    </div>
                    <Badge tone={days < 0 ? "rose" : days <= 30 ? "amber" : "slate"}>
                      {days < 0 ? `Expired ${formatDate(b.expiryDate)}` : `${days} days`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nothing expiring soon" />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent sales" action={<Link href="/sales" className="text-xs font-semibold text-emerald-600 hover:underline">All sales</Link>} />
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Customer</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Time</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.recentSales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <Td>
                  <Link href={`/sales/${s.id}`} className="font-semibold text-emerald-700 hover:underline">
                    {s.invoiceNo}
                  </Link>
                </Td>
                <Td>{s.customerName ?? <span className="text-slate-400">Walk-in</span>}</Td>
                <Td className="capitalize">{s.paymentMethod}</Td>
                <Td>
                  <SaleStatus status={s.status} />
                </Td>
                <Td className="text-slate-500">{formatDateTime(s.createdAt, settings.timezone)}</Td>
                <Td className="text-right font-semibold text-slate-900">{money(s.total)}</Td>
              </tr>
            ))}
            {!data.recentSales.length && (
              <tr>
                <Td colSpan={6}>
                  <EmptyState title="No sales yet" description="Open the point of sale to ring up your first sale." />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function AlertTile({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: number; tone: "amber" | "rose" | "sky" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset ${value > 0 ? tones[tone] : "bg-slate-50 text-slate-400 ring-slate-200"}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-xl font-bold text-slate-900">{value}</span>
    </Link>
  );
}
