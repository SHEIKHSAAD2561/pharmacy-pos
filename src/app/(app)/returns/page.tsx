"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";
import { useSession } from "@/components/session";
import { Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { formatDateTime, titleCase } from "@/lib/format";

type ReturnRow = {
  id: number;
  returnNo: string;
  saleId: number;
  invoiceNo: string;
  reason: string;
  refundMethod: string;
  refundAmount: number;
  userName: string | null;
  createdAt: string;
};

export default function ReturnsPage() {
  const { money, settings } = useSession();
  const { data, error, loading, reload } = useApi<ReturnRow[]>("/api/returns");
  const total = (data ?? []).reduce((s, r) => s + r.refundAmount, 0);

  return (
    <div>
      <PageHeader
        icon={<Undo2 className="h-5 w-5" />}
        title="Returns & refunds"
        description="To start a return, open the original invoice in Sales History."
      />
      <Card>
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : data?.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Return</Th>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>Reason</Th>
                  <Th>Processed by</Th>
                  <Th>Method</Th>
                  <Th className="text-right">Refund</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <Td className="font-semibold text-slate-900">{r.returnNo}</Td>
                    <Td>
                      <Link href={`/sales/${r.saleId}`} className="font-semibold text-emerald-700 hover:underline">
                        {r.invoiceNo}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{formatDateTime(r.createdAt, settings.timezone)}</Td>
                    <Td>{r.reason}</Td>
                    <Td>{r.userName ?? "—"}</Td>
                    <Td>{titleCase(r.refundMethod)}</Td>
                    <Td className="text-right font-semibold text-rose-600">−{money(r.refundAmount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-4 py-3 text-right text-sm text-slate-600">
              Total refunded: <b className="text-slate-900">{money(total)}</b>
            </p>
          </>
        ) : (
          <EmptyState icon={<Undo2 className="h-5 w-5" />} title="No returns yet" description="Returns you process from a sale will be listed here." />
        )}
      </Card>
    </div>
  );
}
