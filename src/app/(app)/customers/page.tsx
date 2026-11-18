"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Plus, Users } from "lucide-react";
import { CustomerFormModal } from "@/components/customer-form";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SearchInput, Table, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { money, settings } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [formOpen, setFormOpen] = useState(false);
  const { data, error, loading, reload } = useApi<Customer[]>(`/api/customers${dq ? `?q=${encodeURIComponent(dq)}` : ""}`);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      "patients.csv",
      ["Name", "Phone", "Email", "Date of birth", "Allergies", "Conditions", "Insurance", "Policy", "Coverage %", "Points", "Visits", "Total spent"],
      data.map((c) => [c.name, c.phone, c.email, c.dateOfBirth ?? "", c.allergies, c.chronicConditions, c.insuranceProvider, c.insuranceNumber, c.insuranceCoverage, c.loyaltyPoints, c.visits ?? 0, c.totalSpent ?? 0]),
    );
  }

  return (
    <div>
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Patients"
        description="Patient profiles with allergies, insurance, loyalty points and history."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New patient
            </Button>
          </>
        }
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Name, phone, email or policy number…" className="max-w-md" />
        </div>
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Patient</Th>
                <Th>Contact</Th>
                <Th>Alerts</Th>
                <Th>Insurance</Th>
                {settings.loyaltyEnabled && <Th className="text-right">Points</Th>}
                <Th className="text-right">Visits</Th>
                <Th className="text-right">Lifetime spend</Th>
                <Th>Last visit</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-xs font-bold text-emerald-700">
                        {c.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="font-semibold text-slate-900 hover:text-emerald-700">{c.name}</span>
                    </Link>
                  </Td>
                  <Td>
                    {c.phone || "—"}
                    {c.email && <span className="block text-xs text-slate-500">{c.email}</span>}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {c.allergies && <Badge tone="rose">Allergy: {c.allergies}</Badge>}
                      {c.chronicConditions && <Badge tone="amber">{c.chronicConditions.split(",")[0]}</Badge>}
                      {!c.allergies && !c.chronicConditions && <span className="text-slate-400">—</span>}
                    </span>
                  </Td>
                  <Td>{c.insuranceProvider ? <Badge tone="sky">{`${c.insuranceProvider} · ${c.insuranceCoverage}%`}</Badge> : <span className="text-slate-400">Self-pay</span>}</Td>
                  {settings.loyaltyEnabled && <Td className="text-right font-medium">{c.loyaltyPoints}</Td>}
                  <Td className="text-right">{c.visits ?? 0}</Td>
                  <Td className="text-right font-semibold text-slate-900">{money(c.totalSpent ?? 0)}</Td>
                  <Td className="text-slate-500">{c.lastVisit ? formatDate(c.lastVisit, settings.timezone) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No patients yet" description="Add patients to track allergies, insurance and loyalty." />
        )}
      </Card>
      {formOpen && <CustomerFormModal open onClose={() => setFormOpen(false)} onSaved={() => reload()} />}
    </div>
  );
}
