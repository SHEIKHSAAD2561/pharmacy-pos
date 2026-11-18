"use client";

import { Badge, type Tone } from "./ui";
import { daysUntil, formatDate, titleCase } from "@/lib/format";

const SALE: Record<string, Tone> = { completed: "emerald", partially_refunded: "amber", refunded: "rose" };
const RX: Record<string, Tone> = { pending: "amber", dispensed: "emerald", cancelled: "slate" };
const PO: Record<string, Tone> = { draft: "slate", ordered: "sky", partially_received: "amber", received: "emerald", cancelled: "rose" };
const ROLE: Record<string, Tone> = { admin: "violet", pharmacist: "teal", cashier: "sky" };
const MOVE: Record<string, Tone> = {
  purchase: "emerald",
  opening: "teal",
  sale: "sky",
  return: "violet",
  adjustment: "slate",
  expired: "rose",
  damaged: "amber",
};

export const SaleStatus = ({ status }: { status: string }) => <Badge tone={SALE[status]}>{titleCase(status)}</Badge>;
export const RxStatus = ({ status }: { status: string }) => <Badge tone={RX[status]}>{titleCase(status)}</Badge>;
export const PoStatus = ({ status }: { status: string }) => <Badge tone={PO[status]}>{titleCase(status)}</Badge>;
export const RoleBadge = ({ role }: { role: string }) => <Badge tone={ROLE[role]}>{titleCase(role)}</Badge>;
export const MovementBadge = ({ type }: { type: string }) => <Badge tone={MOVE[type]}>{titleCase(type)}</Badge>;

export function StockBadge({ stock, reorderLevel }: { stock: number; reorderLevel: number }) {
  if (stock <= 0) return <Badge tone="rose">Out of stock</Badge>;
  if (stock <= reorderLevel) return <Badge tone="amber">Low · {stock}</Badge>;
  return <Badge tone="emerald">{stock} in stock</Badge>;
}

export function ExpiryBadge({ date, alertDays = 90 }: { date: string | null | undefined; alertDays?: number }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">—</span>;
  if (days < 0) return <Badge tone="rose">Expired {formatDate(date)}</Badge>;
  if (days <= 30) return <Badge tone="rose">{formatDate(date)} · {days}d</Badge>;
  if (days <= alertDays) return <Badge tone="amber">{formatDate(date)} · {days}d</Badge>;
  return <span className="text-sm text-slate-600">{formatDate(date)}</span>;
}
