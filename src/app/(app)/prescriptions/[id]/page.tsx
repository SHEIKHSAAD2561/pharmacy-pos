"use client";

import Link from "next/link";
import { use } from "react";
import { AlertTriangle, ArrowLeft, Ban, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/session";
import { RxStatus } from "@/components/status";
import { Button, Card, CardHeader, ErrorBlock, LoadingBlock, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PrescriptionDetail } from "@/lib/types";

export default function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { money, can, settings } = useSession();
  const { data: rx, error, loading, reload } = useApi<PrescriptionDetail>(`/api/prescriptions/${id}`);

  async function cancel() {
    if (!rx || !confirm(`Cancel prescription ${rx.code}?`)) return;
    try {
      await api(`/api/prescriptions/${rx.id}`, { method: "PATCH", body: { status: "cancelled" } });
      toast.success("Prescription cancelled");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading && !rx) return <LoadingBlock />;
  if (error || !rx) return <ErrorBlock message={error ?? "Not found"} onRetry={reload} />;
  const estimate = rx.items.reduce((s, i) => s + i.sellPrice * i.quantity, 0);

  return (
    <div className="space-y-6">
      <Link href="/prescriptions" className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Prescriptions
      </Link>
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            {rx.code} <RxStatus status={rx.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Recorded {formatDateTime(rx.createdAt, settings.timezone)}
            {rx.createdByName && ` by ${rx.createdByName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print labels
          </Button>
          {rx.status === "pending" && can("admin", "pharmacist") && (
            <Button variant="ghost" onClick={cancel}>
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
          {rx.status === "pending" && (
            <Link href={`/pos?rx=${rx.id}`}>
              <Button>
                <ShoppingCart className="h-4 w-4" /> Dispense at POS
              </Button>
            </Link>
          )}
          {rx.saleId && (
            <Link href={`/sales/${rx.saleId}`}>
              <Button variant="outline">View sale</Button>
            </Link>
          )}
        </div>
      </div>

      {rx.warnings.length > 0 && (
        <div className="no-print space-y-2">
          {rx.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="no-print grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Patient</h3>
          <Link href={`/customers/${rx.customer.id}`} className="mt-2 block text-lg font-bold text-emerald-700 hover:underline">
            {rx.customer.name}
          </Link>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Phone" value={rx.customer.phone || "—"} />
            <Row label="Date of birth" value={rx.customer.dateOfBirth ? formatDate(rx.customer.dateOfBirth) : "—"} />
            <Row label="Allergies" value={rx.customer.allergies || "None recorded"} danger={!!rx.customer.allergies} />
            <Row label="Insurance" value={rx.customer.insuranceProvider ? `${rx.customer.insuranceProvider} (${rx.customer.insuranceCoverage}%)` : "Self-pay"} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Prescriber</h3>
          <p className="mt-2 text-lg font-bold text-slate-900">{rx.doctorName}</p>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="License" value={rx.doctorLicense || "—"} />
            <Row label="Clinic" value={rx.clinic || "—"} />
            <Row label="Issued" value={formatDate(rx.issueDate)} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Clinical</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Diagnosis" value={rx.diagnosis || "—"} />
            <Row label="Estimated price" value={money(estimate)} />
          </dl>
          {rx.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{rx.notes}</p>}
        </Card>
      </div>

      <Card className="no-print">
        <CardHeader title="Prescribed medicines" />
        <Table>
          <thead>
            <tr>
              <Th>Medicine</Th>
              <Th>Dosage</Th>
              <Th>Duration</Th>
              <Th>Instructions</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">In stock</Th>
            </tr>
          </thead>
          <tbody>
            {rx.items.map((i) => (
              <tr key={i.id}>
                <Td>
                  <span className="font-semibold text-slate-900">
                    {i.productName} {i.strength}
                  </span>
                  <span className="block text-xs text-slate-500">{i.genericName}</span>
                </Td>
                <Td>{i.dosage || "—"}</Td>
                <Td>{i.duration || "—"}</Td>
                <Td>{i.instructions || "—"}</Td>
                <Td className="text-right font-semibold">{i.quantity}</Td>
                <Td className={`text-right font-medium ${i.stock < i.quantity ? "text-rose-600" : "text-emerald-600"}`}>{i.stock}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Printable dispensing labels */}
      <div className="print-area hidden print:block">
        {rx.items.map((i) => (
          <div key={i.id} className="mb-4 break-inside-avoid rounded border border-slate-400 p-3 font-mono text-[11px]">
            <p className="font-bold">{settings.pharmacyName}</p>
            <p>{settings.phone}</p>
            <p className="mt-1 text-[13px] font-bold">
              {i.productName} {i.strength} × {i.quantity}
            </p>
            <p>{i.dosage}</p>
            {i.duration && <p>For {i.duration}</p>}
            {i.instructions && <p>{i.instructions}</p>}
            <p className="mt-1">
              Patient: {rx.customer.name} · {rx.code} · {formatDate(rx.issueDate)}
            </p>
            <p>Dr. {rx.doctorName.replace(/^Dr\.?\s*/i, "")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={danger ? "text-right font-semibold text-rose-600" : "text-right text-slate-800"}>{value}</dd>
    </div>
  );
}
