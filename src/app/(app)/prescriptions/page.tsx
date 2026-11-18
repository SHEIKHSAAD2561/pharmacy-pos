"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useSession } from "@/components/session";
import { RxStatus } from "@/components/status";
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SearchInput, Table, Tabs, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { formatDate } from "@/lib/format";
import type { PrescriptionListItem } from "@/lib/types";

type Status = "" | "pending" | "dispensed" | "cancelled";

export default function PrescriptionsPage() {
  const { can } = useSession();
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s !== null) setStatus(s as Status);
  }, []);

  const { data, error, loading, reload } = useApi<PrescriptionListItem[]>(`/api/prescriptions?status=${status}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);

  return (
    <div>
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Prescriptions"
        description="Record prescriptions, screen for allergies and dispense them at the counter."
        actions={
          can("admin", "pharmacist") && (
            <Link href="/prescriptions/new">
              <Button>
                <Plus className="h-4 w-4" /> New prescription
              </Button>
            </Link>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs<Status>
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: "To dispense" },
              { value: "dispensed", label: "Dispensed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "", label: "All" },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Code, patient or doctor…" className="w-full sm:w-72" />
        </div>
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Patient</Th>
                <Th>Prescriber</Th>
                <Th>Issued</Th>
                <Th className="text-right">Items</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.map((rx) => (
                <tr key={rx.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/prescriptions/${rx.id}`} className="font-semibold text-emerald-700 hover:underline">
                      {rx.code}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900">{rx.customerName}</span>
                    {rx.customerPhone && <span className="block text-xs text-slate-500">{rx.customerPhone}</span>}
                  </Td>
                  <Td>
                    {rx.doctorName}
                    {rx.clinic && <span className="block text-xs text-slate-500">{rx.clinic}</span>}
                  </Td>
                  <Td className="text-slate-500">{formatDate(rx.issueDate)}</Td>
                  <Td className="text-right">{rx.itemCount}</Td>
                  <Td>
                    <RxStatus status={rx.status} />
                  </Td>
                  <Td className="text-right">
                    {rx.status === "pending" && (
                      <Link href={`/pos?rx=${rx.id}`}>
                        <Button size="sm">Dispense</Button>
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No prescriptions here" />
        )}
      </Card>
    </div>
  );
}
