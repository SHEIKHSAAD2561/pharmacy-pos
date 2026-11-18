"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Gift, HeartPulse, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormModal } from "@/components/customer-form";
import { useSession } from "@/components/session";
import { RxStatus, SaleStatus } from "@/components/status";
import { Button, Card, CardHeader, EmptyState, ErrorBlock, LoadingBlock, StatCard, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Customer } from "@/lib/types";

type Detail = Customer & {
  sales: { id: number; invoiceNo: string; total: number; amountDue: number; status: string; paymentMethod: string; createdAt: string }[];
  prescriptions: { id: number; code: string; doctorName: string; issueDate: string; status: string }[];
};

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { money, settings, can } = useSession();
  const { data: c, error, loading, reload } = useApi<Detail>(`/api/customers/${id}`);
  const [editOpen, setEditOpen] = useState(false);

  async function remove() {
    if (!c || !confirm(`Delete ${c.name}? Their sales stay on record without the patient link.`)) return;
    try {
      await api(`/api/customers/${c.id}`, { method: "DELETE" });
      toast.success("Patient deleted");
      router.push("/customers");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading && !c) return <LoadingBlock />;
  if (error || !c) return <ErrorBlock message={error ?? "Not found"} onRetry={reload} />;
  const spent = c.sales.reduce((s, x) => s + x.amountDue, 0);
  const years = age(c.dateOfBirth);

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Patients
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-600/20">
            {c.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{c.name}</h1>
            <p className="text-sm text-slate-500">
              {[c.gender, years !== null && `${years} years`, c.phone, c.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          {can("admin") && (
            <Button variant="ghost" onClick={remove} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          )}
        </div>
      </div>

      {c.allergies && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="h-5 w-5" />
          <span>
            <b>Allergies:</b> {c.allergies}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visits" value={c.sales.length} icon={<HeartPulse className="h-5 w-5" />} footer={c.sales[0] ? `Last visit ${formatDate(c.sales[0].createdAt, settings.timezone)}` : "No visits yet"} />
        <StatCard label="Paid by patient" value={money(spent)} tone="sky" icon={<HeartPulse className="h-5 w-5" />} />
        <StatCard
          label="Insurance"
          value={c.insuranceProvider || "Self-pay"}
          tone="violet"
          icon={<ShieldCheck className="h-5 w-5" />}
          footer={c.insuranceProvider ? `${c.insuranceNumber || "No policy no."} · covers ${c.insuranceCoverage}% of Rx` : undefined}
        />
        {settings.loyaltyEnabled && (
          <StatCard
            label="Loyalty points"
            value={c.loyaltyPoints}
            tone="amber"
            icon={<Gift className="h-5 w-5" />}
            footer={`Worth ${money(c.loyaltyPoints * settings.loyaltyPointValue)}`}
          />
        )}
      </div>

      {(c.chronicConditions || c.address || c.notes) && (
        <Card className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chronic conditions</p>
            <p className="mt-1 text-slate-800">{c.chronicConditions || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
            <p className="mt-1 text-slate-800">{c.address || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-1 whitespace-pre-line text-slate-800">{c.notes || "—"}</p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Purchase history" />
          {c.sales.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {c.sales.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/sales/${s.id}`} className="font-semibold text-emerald-700 hover:underline">
                        {s.invoiceNo}
                      </Link>
                    </Td>
                    <Td className="text-slate-500">{formatDateTime(s.createdAt, settings.timezone)}</Td>
                    <Td>
                      <SaleStatus status={s.status} />
                    </Td>
                    <Td className="text-right font-semibold">{money(s.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No purchases yet" />
          )}
        </Card>
        <Card>
          <CardHeader title="Prescriptions" action={can("admin", "pharmacist") && <Link href="/prescriptions/new" className="text-xs font-semibold text-emerald-600 hover:underline">New</Link>} />
          {c.prescriptions.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Prescriber</Th>
                  <Th>Issued</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {c.prescriptions.map((rx) => (
                  <tr key={rx.id}>
                    <Td>
                      <Link href={`/prescriptions/${rx.id}`} className="font-semibold text-emerald-700 hover:underline">
                        {rx.code}
                      </Link>
                    </Td>
                    <Td>{rx.doctorName}</Td>
                    <Td className="text-slate-500">{formatDate(rx.issueDate)}</Td>
                    <Td>
                      <RxStatus status={rx.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No prescriptions on file" />
          )}
        </Card>
      </div>

      {editOpen && <CustomerFormModal open customer={c} onClose={() => setEditOpen(false)} onSaved={() => reload()} />}
    </div>
  );
}
