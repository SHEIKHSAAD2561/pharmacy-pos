"use client";

import { useMemo, useState } from "react";
import { Building2, Coins, Gift, Package, Receipt, Save, Settings as SettingsIcon, Tags } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Badge, Button, Card, CardHeader, cn, Field, Input, PageHeader, Select, Switch, Textarea } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { CURRENCIES, currencyDecimals, formatMoney, type AppSettings } from "@/lib/format";
import type { Category } from "@/lib/types";

const SECTIONS = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "currency", label: "Currency & tax", icon: Coins },
  { id: "receipt", label: "Receipts", icon: Receipt },
  { id: "inventory", label: "Inventory & safety", icon: Package },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "categories", label: "Categories", icon: Tags },
] as const;

const COLORS = ["emerald", "teal", "sky", "blue", "violet", "pink", "rose", "red", "amber", "lime", "cyan", "slate"];

function zones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export default function SettingsPage() {
  const { settings, refresh } = useSession();
  const [form, setForm] = useState<AppSettings>(settings);
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("business");
  const [busy, setBusy] = useState(false);
  const tzs = useMemo(() => zones(), []);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  async function save() {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, setupCompleted, updatedAt, ...payload } = form;
      await api("/api/settings", {
        method: "PUT",
        body: {
          ...payload,
          taxRate: Number(payload.taxRate),
          currencyDecimals: Number(payload.currencyDecimals),
          lowStockThreshold: Number(payload.lowStockThreshold),
          expiryAlertDays: Number(payload.expiryAlertDays),
          loyaltyPointsPerUnit: Number(payload.loyaltyPointsPerUnit),
          loyaltyPointValue: Number(payload.loyaltyPointValue),
        },
      });
      await refresh();
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleGate roles={["admin"]}>
      <PageHeader
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        description="Configure your pharmacy, currency, tax, receipts and safety rules."
        actions={
          <Button onClick={save} loading={busy} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                section === s.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
              )}
            >
              <s.icon className={cn("h-4 w-4", section === s.id ? "text-emerald-600" : "")} /> {s.label}
            </button>
          ))}
        </nav>

        <div>
          {section === "business" && (
            <Card>
              <CardHeader title="Business details" description="Shown on receipts, purchase orders and labels." />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Pharmacy name" required>
                  <Input value={form.pharmacyName} onChange={(e) => set("pharmacyName", e.target.value)} />
                </Field>
                <Field label="Legal / company name">
                  <Input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="City">
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="Country">
                  <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Website">
                  <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
                </Field>
                <Field label="Pharmacy license no.">
                  <Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
                </Field>
                <Field label="Time zone" hint="Used for 'today', daily reports and receipt times.">
                  <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    {tzs.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {section === "currency" && (
            <Card>
              <CardHeader title="Currency & tax" description="Change the currency at any time; prices are stored as numbers and are not converted." />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Currency">
                  <Select
                    value={form.currencyCode}
                    onChange={(e) => {
                      set("currencyCode", e.target.value);
                      set("currencyDecimals", currencyDecimals(e.target.value));
                    }}
                  >
                    {!CURRENCIES.some((c) => c.code === form.currencyCode) && <option value={form.currencyCode}>{form.currencyCode}</option>}
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Other ISO currency code" hint="Use any 3-letter ISO 4217 code not in the list.">
                  <Input value={form.currencyCode} maxLength={3} onChange={(e) => set("currencyCode", e.target.value.toUpperCase())} className="font-mono uppercase" />
                </Field>
                <Field label="Custom symbol" hint="Optional. Overrides the standard symbol.">
                  <Input value={form.currencySymbol} maxLength={6} onChange={(e) => set("currencySymbol", e.target.value)} />
                </Field>
                <Field label="Decimal places">
                  <Input type="number" min={0} max={4} value={form.currencyDecimals} onChange={(e) => set("currencyDecimals", Number(e.target.value))} />
                </Field>
                <Field label="Number format">
                  <Select value={form.locale} onChange={(e) => set("locale", e.target.value)}>
                    <option value="en-US">1,234.56 (US / International)</option>
                    <option value="en-GB">1,234.56 (UK)</option>
                    <option value="de-DE">1.234,56 (Europe)</option>
                    <option value="fr-FR">1 234,56 (France)</option>
                    <option value="en-IN">1,23,456.78 (India)</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <div className="w-full rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    Preview: <b>{formatMoney(1234.5, form)}</b>
                  </div>
                </div>
                <Field label="Tax name">
                  <Input value={form.taxName} onChange={(e) => set("taxName", e.target.value)} placeholder="VAT, GST…" />
                </Field>
                <Field label="Tax rate (%)">
                  <Input type="number" min={0} max={100} step="0.01" value={form.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} />
                </Field>
                <Field label="Tax registration no.">
                  <Input value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Switch
                    checked={form.pricesIncludeTax}
                    onChange={(v) => set("pricesIncludeTax", v)}
                    label="Prices include tax"
                    description="On: the shelf price is final and tax is extracted from it. Off: tax is added on top at checkout."
                  />
                </div>
              </div>
            </Card>
          )}

          {section === "receipt" && (
            <Card>
              <CardHeader title="Receipts & invoices" />
              <div className="grid gap-4 p-5">
                <Field label="Invoice number prefix" hint={`Next invoices look like ${form.invoicePrefix}-000123`}>
                  <Input value={form.invoicePrefix} maxLength={10} onChange={(e) => set("invoicePrefix", e.target.value)} className="max-w-40 font-mono" />
                </Field>
                <Field label="Receipt header">
                  <Textarea value={form.receiptHeader} onChange={(e) => set("receiptHeader", e.target.value)} placeholder="e.g. Open 24/7 · Free home delivery" />
                </Field>
                <Field label="Receipt footer">
                  <Textarea value={form.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} />
                </Field>
              </div>
            </Card>
          )}

          {section === "inventory" && (
            <Card>
              <CardHeader title="Inventory & dispensing safety" />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <Field label="Expiry warning window (days)" hint="Batches expiring within this window are flagged.">
                  <Input type="number" min={1} max={730} value={form.expiryAlertDays} onChange={(e) => set("expiryAlertDays", Number(e.target.value))} />
                </Field>
                <Field label="Default reorder level" hint="Suggested for new medicines.">
                  <Input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", Number(e.target.value))} />
                </Field>
                <div className="space-y-4 sm:col-span-2">
                  <Switch
                    checked={form.blockExpiredSales}
                    onChange={(v) => set("blockExpiredSales", v)}
                    label="Block sale of expired batches"
                    description="Strongly recommended. Expired stock is skipped when allocating batches."
                  />
                  <Switch
                    checked={form.requirePrescriptionCheck}
                    onChange={(v) => set("requirePrescriptionCheck", v)}
                    label="Require a prescription for Rx medicines"
                    description="Prescription-only and controlled items cannot be sold without an attached prescription."
                  />
                </div>
              </div>
            </Card>
          )}

          {section === "loyalty" && (
            <Card>
              <CardHeader title="Loyalty program" />
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Switch checked={form.loyaltyEnabled} onChange={(v) => set("loyaltyEnabled", v)} label="Enable loyalty points" description="Registered patients earn points on what they pay and can redeem them at checkout." />
                </div>
                <Field label={`Points earned per 1 ${form.currencyCode}`}>
                  <Input type="number" min={0} step="0.1" value={form.loyaltyPointsPerUnit} onChange={(e) => set("loyaltyPointsPerUnit", Number(e.target.value))} disabled={!form.loyaltyEnabled} />
                </Field>
                <Field label="Value of 1 point" hint={`100 points = ${formatMoney(100 * (Number(form.loyaltyPointValue) || 0), form)}`}>
                  <Input type="number" min={0} step="0.001" value={form.loyaltyPointValue} onChange={(e) => set("loyaltyPointValue", Number(e.target.value))} disabled={!form.loyaltyEnabled} />
                </Field>
              </div>
            </Card>
          )}

          {section === "categories" && <CategoriesCard />}
        </div>
      </div>
    </RoleGate>
  );
}

function CategoriesCard() {
  const { data, reload } = useApi<Category[]>("/api/categories");
  const [name, setName] = useState("");
  const [color, setColor] = useState("emerald");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/categories", { body: { name, color } });
      setName("");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function remove(c: Category) {
    if (!confirm(`Delete category ${c.name}? Its medicines become uncategorized.`)) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader title="Medicine categories" description="Used to organize the catalog, POS and reports." />
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-5">
        <Field label="Name" className="min-w-48 flex-1">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Color">
          <Select value={color} onChange={(e) => setColor(e.target.value)}>
            {COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit">Add</Button>
      </form>
      <ul className="divide-y divide-slate-100">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-5 py-3">
            <Badge tone={c.color}>{c.name}</Badge>
            <span className="flex items-center gap-4 text-sm text-slate-500">
              {c.productCount} medicines
              <button onClick={() => remove(c)} className="text-xs font-semibold text-rose-600 hover:underline">
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
