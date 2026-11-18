"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import type { Customer } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  allergies: "",
  chronicConditions: "",
  insuranceProvider: "",
  insuranceNumber: "",
  insuranceCoverage: 0,
  notes: "",
};

export function CustomerFormModal({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSaved: (c: Customer) => void;
}) {
  const [form, setForm] = useState(() =>
    customer ? { ...EMPTY, ...customer, dateOfBirth: customer.dateOfBirth ?? "" } : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender,
        address: form.address,
        allergies: form.allergies,
        chronicConditions: form.chronicConditions,
        insuranceProvider: form.insuranceProvider,
        insuranceNumber: form.insuranceNumber,
        insuranceCoverage: Number(form.insuranceCoverage) || 0,
        notes: form.notes,
      };
      const saved = customer
        ? await api<Customer>(`/api/customers/${customer.id}`, { method: "PUT", body: payload })
        : await api<Customer>("/api/customers", { body: payload });
      toast.success(customer ? "Patient updated" : "Patient added");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={customer ? "Edit patient" : "New patient"}
      description="Allergies and insurance details are checked automatically at checkout."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={busy}>
            Save patient
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2">
          <Input required autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Not specified</option>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Allergies" hint="Separate with commas, e.g. Penicillin, Sulfa" className="sm:col-span-2">
          <Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </Field>
        <Field label="Chronic conditions" className="sm:col-span-2">
          <Input value={form.chronicConditions} onChange={(e) => set("chronicConditions", e.target.value)} />
        </Field>
        <Field label="Insurance provider">
          <Input value={form.insuranceProvider} onChange={(e) => set("insuranceProvider", e.target.value)} />
        </Field>
        <Field label="Policy / member no.">
          <Input value={form.insuranceNumber} onChange={(e) => set("insuranceNumber", e.target.value)} />
        </Field>
        <Field label="Coverage on prescriptions (%)">
          <Input type="number" min={0} max={100} value={form.insuranceCoverage} onChange={(e) => set("insuranceCoverage", e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
