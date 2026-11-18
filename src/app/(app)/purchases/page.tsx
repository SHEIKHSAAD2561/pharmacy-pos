"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { RoleGate } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { PoStatus } from "@/components/status";
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SearchInput, Table, Tabs, Td, Th } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/client/api";
import { formatDate } from "@/lib/format";

type PoRow = {
  id: number;
  poNumber: string;
  supplierName: string;
  status: string;
  expectedDate: string | null;
  total: number;
  createdAt: string;
  receivedAt: string | null;
  itemCount: number;
};

export default function PurchasesPage() {
  const { money, settings } = useSession();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<PoRow[]>(`/api/purchases?status=${status}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <PageHeader
        icon={<ClipboardList className="h-5 w-5" />}
        title="Purchase orders"
        description="Order from suppliers and receive deliveries straight into batches."
        actions={
          <Link href="/purchases/new">
            <Button>
              <Plus className="h-4 w-4" /> New order
            </Button>
          </Link>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "ordered", label: "Ordered" },
              { value: "partially_received", label: "Partly received" },
              { value: "received", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="PO number or supplier…" className="w-full sm:w-64" />
        </div>
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Supplier</Th>
                <Th>Created</Th>
                <Th>Expected</Th>
                <Th className="text-right">Items</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/purchases/${po.id}`} className="font-semibold text-emerald-700 hover:underline">
                      {po.poNumber}
                    </Link>
                  </Td>
                  <Td className="font-medium text-slate-900">{po.supplierName}</Td>
                  <Td className="text-slate-500">{formatDate(po.createdAt, settings.timezone)}</Td>
                  <Td className="text-slate-500">{formatDate(po.expectedDate)}</Td>
                  <Td className="text-right">{po.itemCount}</Td>
                  <Td>
                    <PoStatus status={po.status} />
                  </Td>
                  <Td className="text-right font-semibold">{money(po.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No purchase orders" />
        )}
      </Card>
    </RoleGate>
  );
}
