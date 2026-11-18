"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Receipt } from "lucide-react";
import { useSession } from "@/components/session";
import { SaleStatus } from "@/components/status";
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, PageHeader, SearchInput, Select, Table, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, shiftISO, titleCase, todayLocalISO } from "@/lib/format";

type SaleRow = {
  id: number;
  invoiceNo: string;
  customerName: string | null;
  cashierName: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insuranceAmount: number;
  amountDue: number;
  refundedAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
};

export default function SalesPage() {
  const { money, settings } = useSession();
  const [from, setFrom] = useState(shiftISO(todayLocalISO(), -29));
  const [to, setTo] = useState(todayLocalISO());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const dq = useDebounced(q);
  const url = `/api/sales?from=${from}&to=${to}${dq ? `&q=${encodeURIComponent(dq)}` : ""}${status ? `&status=${status}` : ""}${payment ? `&payment=${payment}` : ""}&limit=1000`;
  const { data, error, loading, reload } = useApi<SaleRow[]>(url);

  const totals = (data ?? []).reduce(
    (acc, s) => ({ total: acc.total + s.total, refunds: acc.refunds + s.refundedAmount, tax: acc.tax + s.tax, insurance: acc.insurance + s.insuranceAmount }),
    { total: 0, refunds: 0, tax: 0, insurance: 0 },
  );

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `sales-${from}-to-${to}.csv`,
      ["Invoice", "Date", "Customer", "Cashier", "Subtotal", "Discount", "Tax", "Total", "Insurance", "Patient paid", "Refunded", "Payment", "Status"],
      data.map((s) => [s.invoiceNo, s.createdAt, s.customerName ?? "Walk-in", s.cashierName ?? "", s.subtotal, s.discount, s.tax, s.total, s.insuranceAmount, s.amountDue, s.refundedAmount, s.paymentMethod, s.status]),
    );
  }

  return (
    <div>
      <PageHeader
        icon={<Receipt className="h-5 w-5" />}
        title="Sales history"
        description="Find any invoice, reprint receipts and process returns."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="partially_refunded">Partially refunded</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>
          <Field label="Payment">
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">All</option>
              {["cash", "card", "mixed", "other", "insurance", "points"].map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search">
            <SearchInput value={q} onChange={setQ} placeholder="Invoice, patient, phone" />
          </Field>
        </div>

        {data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            <Summary label="Invoices" value={String(data.length)} />
            <Summary label="Sales total" value={money(totals.total)} />
            <Summary label="Refunded" value={money(totals.refunds)} />
            <Summary label={`${settings.taxName} collected`} value={money(totals.tax)} />
          </div>
        )}

        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th>Cashier</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/sales/${s.id}`} className="font-semibold text-emerald-700 hover:underline">
                      {s.invoiceNo}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDateTime(s.createdAt, settings.timezone)}</Td>
                  <Td>{s.customerName ?? <span className="text-slate-400">Walk-in</span>}</Td>
                  <Td>{s.cashierName ?? "—"}</Td>
                  <Td className="capitalize">{s.paymentMethod}</Td>
                  <Td>
                    <SaleStatus status={s.status} />
                  </Td>
                  <Td className="text-right">
                    <span className="font-semibold text-slate-900">{money(s.total)}</span>
                    {s.refundedAmount > 0 && <span className="block text-xs text-rose-600">−{money(s.refundedAmount)}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="No sales in this period" />
        )}
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
