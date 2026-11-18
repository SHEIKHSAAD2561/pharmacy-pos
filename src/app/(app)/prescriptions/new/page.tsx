"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { CustomerFormModal } from "@/components/customer-form";
import { CustomerPicker, ProductPicker } from "@/components/pickers";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { allergyWarnings } from "@/lib/allergies";
import { api } from "@/lib/client/api";
import { todayLocalISO } from "@/lib/format";
import type { Customer, Product } from "@/lib/types";

type Item = { product: Product; quantity: number; dosage: string; duration: string; instructions: string };

export default function NewPrescriptionPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [form, setForm] = useState({ doctorName: "", doctorLicense: "", clinic: "", issueDate: todayLocalISO(), diagnosis: "", notes: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const warnings = customer ? allergyWarnings(customer.allergies, items.map((i) => ({ name: i.product.name, genericName: i.product.genericName }))) : [];

  function addItem(p: Product) {
    if (items.some((i) => i.product.id === p.id)) return toast.info(`${p.name} is already on the prescription`);
    setItems([...items, { product: p, quantity: 1, dosage: "", duration: "", instructions: "" }]);
  }
  const update = (id: number, patch: Partial<Item>) => setItems(items.map((i) => (i.product.id === id ? { ...i, ...patch } : i)));

  async function save(dispense: boolean) {
    if (!customer) return toast.error("Choose the patient");
    if (!items.length) return toast.error("Add at least one medicine");
    setBusy(true);
    try {
      const rx = await api<{ id: number; code: string }>("/api/prescriptions", {
        body: {
          customerId: customer.id,
          ...form,
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, dosage: i.dosage, duration: i.duration, instructions: i.instructions })),
        },
      });
      toast.success(`Prescription ${rx.code} saved`);
      router.push(dispense ? `/pos?rx=${rx.id}` : `/prescriptions/${rx.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <RoleGate roles={["admin", "pharmacist"]}>
      <Link href="/prescriptions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Prescriptions
      </Link>
      <PageHeader icon={<FileText className="h-5 w-5" />} title="New prescription" description="Transcribe the prescription exactly as written by the prescriber." />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Patient"
              action={
                !customer && (
                  <Button size="sm" variant="outline" onClick={() => setNewPatient(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> New
                  </Button>
                )
              }
            />
            <div className="space-y-3 p-5">
              <CustomerPicker value={customer} onChange={setCustomer} />
              {customer && (
                <dl className="space-y-1 text-sm">
                  {customer.dateOfBirth && <Meta label="Date of birth" value={customer.dateOfBirth} />}
                  <Meta label="Allergies" value={customer.allergies || "None recorded"} danger={!!customer.allergies} />
                  <Meta label="Conditions" value={customer.chronicConditions || "—"} />
                  <Meta label="Insurance" value={customer.insuranceProvider ? `${customer.insuranceProvider} · ${customer.insuranceCoverage}%` : "Self-pay"} />
                </dl>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Prescriber" />
            <div className="grid gap-4 p-5">
              <Field label="Doctor's name" required>
                <Input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="License no.">
                  <Input value={form.doctorLicense} onChange={(e) => setForm({ ...form, doctorLicense: e.target.value })} />
                </Field>
                <Field label="Issue date" required>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
                </Field>
              </div>
              <Field label="Clinic / hospital">
                <Input value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} />
              </Field>
              <Field label="Diagnosis">
                <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
              </Field>
              <Field label="Notes">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Medicines" description="Search and add each prescribed medicine." />
          <div className="space-y-4 p-5">
            <ProductPicker onSelect={addItem} />
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
              </p>
            ))}
            {items.length ? (
              <div className="space-y-3">
                {items.map((i) => (
                  <div key={i.product.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {i.product.name} <span className="font-normal text-slate-500">{i.product.strength}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {i.product.genericName} · {i.product.stock} in stock
                        </p>
                      </div>
                      <button onClick={() => setItems(items.filter((x) => x.product.id !== i.product.id))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <Field label="Quantity">
                        <Input type="number" min={1} value={i.quantity} onChange={(e) => update(i.product.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                      </Field>
                      <Field label="Dosage" className="sm:col-span-2">
                        <Input value={i.dosage} onChange={(e) => update(i.product.id, { dosage: e.target.value })} placeholder="1 tablet twice daily" />
                      </Field>
                      <Field label="Duration">
                        <Input value={i.duration} onChange={(e) => update(i.product.id, { duration: e.target.value })} placeholder="7 days" />
                      </Field>
                      <Field label="Instructions" className="sm:col-span-4">
                        <Input value={i.instructions} onChange={(e) => update(i.product.id, { instructions: e.target.value })} placeholder="Take after food" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No medicines added" description="Search above to add the first prescribed medicine." />
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => save(false)} loading={busy}>
                Save for later
              </Button>
              <Button onClick={() => save(true)} loading={busy}>
                Save & dispense
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {newPatient && <CustomerFormModal open onClose={() => setNewPatient(false)} onSaved={setCustomer} />}
    </RoleGate>
  );
}

function Meta({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={danger ? "text-right font-semibold text-rose-600" : "text-right font-medium text-slate-800"}>{value}</dd>
    </div>
  );
}
