"use client";

import { useState } from "react";
import { Clock, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/session";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";

type Current = {
  shift: { id: number; openedAt: string; openingCash: number } | null;
  summary?: { salesCount: number; salesTotal: number; cashSales: number; cardSales: number; otherSales: number; cashRefunds: number; expectedCash: number };
};

type ShiftRow = {
  id: number;
  userName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  notes: string;
};

export default function ShiftsPage() {
  const { money, settings } = useSession();
  const current = useApi<Current>("/api/shifts/current");
  const history = useApi<ShiftRow[]>("/api/shifts");
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => {
    current.reload();
    history.reload();
  };

  async function openShift() {
    setBusy(true);
    try {
      await api("/api/shifts", { body: { openingCash: Number(cash) || 0, notes } });
      toast.success("Shift opened");
      setOpenModal(false);
      setCash("");
      setNotes("");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!current.data?.shift) return;
    setBusy(true);
    try {
      const r = await api<{ difference: number }>(`/api/shifts/${current.data.shift.id}/close`, { body: { closingCash: Number(cash) || 0, notes } });
      if (Math.abs(r.difference) < 0.005) toast.success("Shift closed — drawer balanced");
      else toast.warning(`Shift closed — drawer ${r.difference > 0 ? "over" : "short"} by ${money(Math.abs(r.difference))}`);
      setCloseModal(false);
      setCash("");
      setNotes("");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = current.data?.summary;
  const counted = Number(cash) || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Clock className="h-5 w-5" />}
        title="Register shifts"
        description="Open the drawer with a float, then count and reconcile it at close."
        actions={
          current.data?.shift ? (
            <Button variant="dark" onClick={() => setCloseModal(true)}>
              <Lock className="h-4 w-4" /> Close my shift
            </Button>
          ) : (
            <Button onClick={() => setOpenModal(true)}>
              <PlayCircle className="h-4 w-4" /> Open shift
            </Button>
          )
        }
      />

      {current.loading && !current.data ? (
        <LoadingBlock />
      ) : current.data?.shift && s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sales this shift" value={money(s.salesTotal)} icon={<Clock className="h-5 w-5" />} footer={`${s.salesCount} transactions since ${formatDateTime(current.data.shift.openedAt, settings.timezone)}`} />
          <StatCard label="Card" value={money(s.cardSales)} tone="sky" icon={<Clock className="h-5 w-5" />} footer={`Other: ${money(s.otherSales)}`} />
          <StatCard label="Cash refunds" value={money(s.cashRefunds)} tone="rose" icon={<Clock className="h-5 w-5" />} />
          <StatCard
            label="Expected in drawer"
            value={money(s.expectedCash)}
            tone="amber"
            icon={<Lock className="h-5 w-5" />}
            footer={`Float ${money(current.data.shift.openingCash)} + cash sales ${money(s.cashSales)}`}
          />
        </div>
      ) : (
        <Card className="p-6 text-sm text-slate-600">You have no open shift. Open one before you start selling to keep your cash drawer reconciled.</Card>
      )}

      <Card>
        <CardHeader title="Shift history" />
        {history.loading && !history.data ? (
          <LoadingBlock />
        ) : history.data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Cashier</Th>
                <Th>Opened</Th>
                <Th>Closed</Th>
                <Th className="text-right">Float</Th>
                <Th className="text-right">Expected</Th>
                <Th className="text-right">Counted</Th>
                <Th className="text-right">Difference</Th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => {
                const diff = h.closingCash !== null && h.expectedCash !== null ? h.closingCash - h.expectedCash : null;
                return (
                  <tr key={h.id}>
                    <Td className="font-medium text-slate-900">{h.userName}</Td>
                    <Td className="text-slate-500">{formatDateTime(h.openedAt, settings.timezone)}</Td>
                    <Td>{h.closedAt ? <span className="text-slate-500">{formatDateTime(h.closedAt, settings.timezone)}</span> : <Badge tone="emerald">Open</Badge>}</Td>
                    <Td className="text-right">{money(h.openingCash)}</Td>
                    <Td className="text-right">{h.expectedCash !== null ? money(h.expectedCash) : "—"}</Td>
                    <Td className="text-right">{h.closingCash !== null ? money(h.closingCash) : "—"}</Td>
                    <Td className="text-right">
                      {diff === null ? (
                        "—"
                      ) : Math.abs(diff) < 0.005 ? (
                        <Badge tone="emerald">Balanced</Badge>
                      ) : (
                        <Badge tone={diff > 0 ? "amber" : "rose"}>
                          {diff > 0 ? "Over" : "Short"} {money(Math.abs(diff))}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Clock className="h-5 w-5" />} title="No shifts yet" />
        )}
      </Card>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        size="sm"
        title="Open shift"
        footer={
          <Button onClick={openShift} loading={busy}>
            Open shift
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Opening cash (float)">
            <Input type="number" min={0} step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus />
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        size="sm"
        title="Close shift"
        description="Count all the cash in the drawer and enter the total."
        footer={
          <Button variant="dark" onClick={closeShift} loading={busy}>
            Close shift
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Counted cash">
            <Input type="number" min={0} step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus />
          </Field>
          {s && cash !== "" && (
            <p className={`rounded-xl px-3 py-2 text-sm ${Math.abs(counted - s.expectedCash) < 0.005 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              Expected {money(s.expectedCash)} ·{" "}
              {Math.abs(counted - s.expectedCash) < 0.005 ? "Balanced" : `${counted > s.expectedCash ? "Over" : "Short"} by ${money(Math.abs(counted - s.expectedCash))}`}
            </p>
          )}
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
