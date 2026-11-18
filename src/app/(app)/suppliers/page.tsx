"use client";

import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Badge, Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, PageHeader, SearchInput, Switch, Textarea } from "@/components/ui";
import { api, useApi, useDebounced } from "@/lib/client/api";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  const { money } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<Supplier[]>(`/api/suppliers${dq ? `?q=${encodeURIComponent(dq)}` : ""}`);
  const [editing, setEditing] = useState<Supplier | null | "new">(null);

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <PageHeader
        icon={<Truck className="h-5 w-5" />}
        title="Suppliers"
        description="Wholesalers and distributors you buy from."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        }
      />
      <div className="mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search suppliers…" className="max-w-sm" />
      </div>
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className={`p-5 ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700">
                    <Truck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.contactPerson || "No contact person"}</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {s.email}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {s.paymentTerms && <Badge tone="slate">{s.paymentTerms}</Badge>}
                {!s.active && <Badge tone="rose">Inactive</Badge>}
                <span className="ml-auto">
                  {s.orderCount ?? 0} orders · {money(s.totalPurchased ?? 0)} received
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Truck className="h-5 w-5" />} title="No suppliers yet" />
        </Card>
      )}
      {editing && <SupplierModal supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </RoleGate>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    taxNumber: supplier?.taxNumber ?? "",
    paymentTerms: supplier?.paymentTerms ?? "",
    notes: supplier?.notes ?? "",
    active: supplier?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (supplier) await api(`/api/suppliers/${supplier.id}`, { method: "PUT", body: form });
      else await api("/api/suppliers", { body: form });
      toast.success("Supplier saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? "Edit supplier" : "Add supplier"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required className="sm:col-span-2">
          <Input required autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Contact person">
          <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Payment terms">
          <Input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="Net 30" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Tax number">
          <Input value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Switch checked={form.active} onChange={(v) => set("active", v)} label="Active" />
        </div>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
