"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Coins, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button, cn, Field, Input, Select, Spinner, Switch } from "@/components/ui";
import { api } from "@/lib/client/api";
import { CURRENCIES, currencyDecimals, formatMoney } from "@/lib/format";

const STEPS = [
  { title: "Pharmacy", icon: Building2 },
  { title: "Currency & tax", icon: Coins },
  { title: "Admin account", icon: UserRound },
];

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => timeZones(), []);

  const [pharmacy, setPharmacy] = useState({
    pharmacyName: "",
    legalName: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: "",
    licenseNumber: "",
    taxNumber: "",
    currencyCode: "USD",
    currencySymbol: "",
    currencyDecimals: 2,
    taxName: "VAT",
    taxRate: 0,
    pricesIncludeTax: false,
    timezone: "UTC",
  });
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });
  const [demoData, setDemoData] = useState(true);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/setup")
      .then((s) => {
        if (!s.needsSetup) router.replace("/login");
        else {
          setPharmacy((p) => ({ ...p, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }));
          setReady(true);
        }
      })
      .catch((e) => toast.error((e as Error).message));
  }, [router]);

  const set = <K extends keyof typeof pharmacy>(k: K, v: (typeof pharmacy)[K]) => setPharmacy((p) => ({ ...p, [k]: v }));

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  async function finish() {
    setBusy(true);
    try {
      await api("/api/setup", { body: { pharmacy, admin, demoData } });
      toast.success("Your pharmacy is ready");
      router.replace("/");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const preview = formatMoney(1234.5, { ...pharmacy, locale: "en-US" });

  return (
    <AuthLayout>
      <div className="w-full max-w-lg">
        {!ready ? (
          <div className="flex justify-center">
            <Spinner className="h-7 w-7" />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-emerald-600">First-time setup</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Set up your pharmacy</h2>
            <p className="mt-2 text-sm text-slate-500">Three quick steps and you are ready to sell. You can change everything later in Settings.</p>

            <ol className="mt-8 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                      i < step ? "bg-emerald-500 text-white" : i === step ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500" : "bg-slate-100 text-slate-400",
                    )}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn("hidden text-xs font-semibold sm:inline", i === step ? "text-slate-900" : "text-slate-400")}>{s.title}</span>
                  {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-emerald-400" : "bg-slate-200")} />}
                </li>
              ))}
            </ol>

            <form onSubmit={next} className="mt-8 space-y-4">
              {step === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pharmacy name" required className="col-span-2">
                    <Input required minLength={2} autoFocus value={pharmacy.pharmacyName} onChange={(e) => set("pharmacyName", e.target.value)} placeholder="e.g. Green Cross Pharmacy" />
                  </Field>
                  <Field label="Legal / company name" className="col-span-2">
                    <Input value={pharmacy.legalName} onChange={(e) => set("legalName", e.target.value)} />
                  </Field>
                  <Field label="Address" className="col-span-2">
                    <Input value={pharmacy.address} onChange={(e) => set("address", e.target.value)} />
                  </Field>
                  <Field label="City">
                    <Input value={pharmacy.city} onChange={(e) => set("city", e.target.value)} />
                  </Field>
                  <Field label="Country">
                    <Input value={pharmacy.country} onChange={(e) => set("country", e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <Input value={pharmacy.phone} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={pharmacy.email} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                  <Field label="Pharmacy license no.">
                    <Input value={pharmacy.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
                  </Field>
                  <Field label="Tax registration no.">
                    <Input value={pharmacy.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Currency" required className="col-span-2">
                    <Select
                      value={pharmacy.currencyCode}
                      onChange={(e) => {
                        set("currencyCode", e.target.value);
                        set("currencyDecimals", currencyDecimals(e.target.value));
                      }}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Custom symbol" hint="Optional, e.g. ﷼ or Rs">
                    <Input value={pharmacy.currencySymbol} maxLength={6} onChange={(e) => set("currencySymbol", e.target.value)} />
                  </Field>
                  <Field label="Decimal places">
                    <Input type="number" min={0} max={4} value={pharmacy.currencyDecimals} onChange={(e) => set("currencyDecimals", Number(e.target.value))} />
                  </Field>
                  <div className="col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    Prices will look like <span className="font-bold">{preview}</span>
                  </div>
                  <Field label="Tax name">
                    <Input value={pharmacy.taxName} onChange={(e) => set("taxName", e.target.value)} placeholder="VAT, GST, Sales tax" />
                  </Field>
                  <Field label="Tax rate (%)">
                    <Input type="number" min={0} max={100} step="0.01" value={pharmacy.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} />
                  </Field>
                  <div className="col-span-2">
                    <Switch
                      checked={pharmacy.pricesIncludeTax}
                      onChange={(v) => set("pricesIncludeTax", v)}
                      label="Shelf prices already include tax"
                      description="Turn on if the price on the box is the final price the customer pays."
                    />
                  </div>
                  <Field label="Time zone" className="col-span-2" hint="Used for daily reports and receipts.">
                    <Select value={pharmacy.timezone} onChange={(e) => set("timezone", e.target.value)}>
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <Field label="Your full name" required>
                    <Input required minLength={2} autoFocus value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} />
                  </Field>
                  <Field label="Email" required>
                    <Input type="email" required value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
                  </Field>
                  <Field label="Password" required hint="At least 8 characters.">
                    <Input type="password" required minLength={8} value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} />
                  </Field>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <Switch
                      checked={demoData}
                      onChange={setDemoData}
                      label="Load demo data"
                      description="Adds sample medicines, batches, patients, prescriptions and a month of sales so you can explore every feature."
                    />
                    {demoData && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Demo staff accounts pharmacist@demo.pharmacy and cashier@demo.pharmacy (password demo1234) are also created. Deactivate them in Staff before going live.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}>
                  Back
                </Button>
                <Button type="submit" size="lg" loading={busy}>
                  {step < STEPS.length - 1 ? "Continue" : busy ? "Setting up…" : "Create pharmacy"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
