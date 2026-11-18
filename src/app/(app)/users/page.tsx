"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { RoleBadge } from "@/components/status";
import { Badge, Button, Card, ErrorBlock, Field, Input, LoadingBlock, Modal, PageHeader, Select, Switch, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";

type StaffUser = { id: number; name: string; email: string; role: "admin" | "pharmacist" | "cashier"; active: boolean; lastLoginAt: string | null; createdAt: string };

const ROLE_HELP = [
  { role: "Admin", text: "Everything, including staff, settings and deleting records." },
  { role: "Pharmacist", text: "Sells, dispenses controlled drugs, manages stock, purchasing, prescriptions, returns and reports." },
  { role: "Cashier", text: "Sells OTC and prescription items with a valid prescription, manages patients and their own shift." },
];

export default function UsersPage() {
  const { user: me, settings } = useSession();
  const { data, error, loading, reload } = useApi<StaffUser[]>("/api/users");
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);

  return (
    <RoleGate roles={["admin"]}>
      <PageHeader
        icon={<UserCog className="h-5 w-5" />}
        title="Staff"
        description="Who can sign in, and what each person is allowed to do."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add staff member
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {ROLE_HELP.map((r) => (
          <Card key={r.role} className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> {r.role}
            </p>
            <p className="mt-1 text-xs text-slate-500">{r.text}</p>
          </Card>
        ))}
      </div>
      <Card>
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold text-slate-900">
                    {u.name} {u.id === me.id && <span className="text-xs font-normal text-slate-400">(you)</span>}
                  </Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <RoleBadge role={u.role} />
                  </Td>
                  <Td>{u.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Deactivated</Badge>}</Td>
                  <Td className="text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, settings.timezone) : "Never"}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <UserModal user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </RoleGate>
  );
}

function UserModal({ user, onClose, onSaved }: { user: StaffUser | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "cashier", active: user?.active ?? true, password: "" });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (user) {
        const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, active: form.active };
        if (form.password) body.password = form.password;
        await api(`/api/users/${user.id}`, { method: "PUT", body });
      } else {
        await api("/api/users", { body: { name: form.name, email: form.email, role: form.role, password: form.password } });
      }
      toast.success("Staff member saved");
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
      size="sm"
      title={user ? `Edit ${user.name}` : "Add staff member"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={save} className="space-y-4">
        <Field label="Full name" required>
          <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Email" required>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffUser["role"] })}>
            <option value="cashier">Cashier</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label={user ? "Reset password" : "Password"} required={!user} hint={user ? "Leave blank to keep the current password. Resetting signs them out everywhere." : "At least 8 characters."}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type="password" required={!user} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pl-9" />
          </div>
        </Field>
        {user && <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Account active" description="Deactivated staff cannot sign in." />}
      </form>
    </Modal>
  );
}
