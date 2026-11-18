"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSession } from "./session";

/** Validated categorical palette (fixed order, never cycled). */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const BRAND = "#059669";

const axisTick = { fontSize: 11, fill: "#64748b" };

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function compact(n: number) {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

type TipItem = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly TipItem[];
  label?: unknown;
  labelFormatter?: (l: string) => string;
  valueFormatter: (v: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{labelFormatter ? labelFormatter(String(label)) : String(label ?? "")}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{String(p.name)}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-900">{valueFormatter(Number(p.value), String(p.dataKey))}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueArea({
  data,
  height = 260,
  dataKey = "revenue",
  name = "Revenue",
}: {
  data: { day: string; [k: string]: number | string }[];
  height?: number;
  dataKey?: string;
  name?: string;
}) {
  const { money } = useSession();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef2f6" />
        <XAxis dataKey="day" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
          content={(p) => <ChartTooltip active={p.active} payload={p.payload as readonly TipItem[]} label={p.label} labelFormatter={shortDate} valueFormatter={(v) => money(v)} />}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#rev-fill)"
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({
  data,
  dataKey,
  labelKey,
  height = 260,
  name,
  format = "money",
  color = BRAND,
}: {
  data: Record<string, number | string>[];
  dataKey: string;
  labelKey: string;
  height?: number;
  name: string;
  format?: "money" | "number";
  color?: string;
}) {
  const { money } = useSession();
  const fmt = (v: number) => (format === "money" ? money(v) : v.toLocaleString("en-US"));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="#eef2f6" />
        <XAxis dataKey={labelKey} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={44} />
        <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload as readonly TipItem[]} label={p.label} valueFormatter={(v) => fmt(v)} />} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal share list: label, value and proportional bar — readable without a legend. */
export function ShareList({
  items,
  format = "money",
}: {
  items: { label: string; value: number; color?: string }[];
  format?: "money" | "number";
}) {
  const { money } = useSession();
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const pct = total > 0 ? (Math.max(0, item.value) / total) * 100 : 0;
        const color = item.color ?? SERIES[idx % SERIES.length];
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900">
                {format === "money" ? money(item.value) : item.value.toLocaleString("en-US")}
                <span className="ml-1.5 text-xs font-normal text-slate-500">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
