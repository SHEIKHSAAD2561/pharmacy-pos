import type { ReactNode } from "react";
import { Activity, BarChart3, FileText, ShieldCheck, ShoppingCart, Timer } from "lucide-react";

const FEATURES = [
  { icon: ShoppingCart, title: "Lightning-fast checkout", text: "Barcode scanning, split payments, insurance and loyalty in one screen." },
  { icon: Timer, title: "Batch & expiry control", text: "First-expiry-first-out dispensing with alerts before stock expires." },
  { icon: FileText, title: "Prescription workflow", text: "Record prescriptions, check allergies and dispense in a click." },
  { icon: BarChart3, title: "Real-time insights", text: "Revenue, profit, best sellers and inventory value at a glance." },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#06141a] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_10%_10%,rgba(16,185,129,0.35),transparent_60%),radial-gradient(700px_500px_at_90%_90%,rgba(13,148,136,0.3),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">PharmaPOS</span>
          </div>

          <div className="max-w-lg">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-white/15">
              <Activity className="h-3.5 w-3.5" /> Built for modern pharmacies
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight">
              Run your whole pharmacy from <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">one place.</span>
            </h1>
            <p className="mt-4 text-base text-slate-300">
              Sales, stock, prescriptions, patients, suppliers and reports — designed for speed at the counter and clarity in the back office.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10 backdrop-blur">
                  <f.icon className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Role-based access · Encrypted sessions · Full audit trail
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-12">{children}</div>
    </div>
  );
}
