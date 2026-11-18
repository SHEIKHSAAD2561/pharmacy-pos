"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [pharmacyName, setPharmacyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean; pharmacyName: string }>("/api/setup")
      .then((s) => {
        if (s.needsSetup) router.replace("/setup");
        else {
          setPharmacyName(s.pharmacyName);
          setChecking(false);
        }
      })
      .catch((e) => {
        setError((e as Error).message);
        setChecking(false);
      });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { body: { email, password } });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        {checking ? (
          <div className="flex justify-center">
            <Spinner className="h-7 w-7" />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-emerald-600">{pharmacyName}</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to open the register and manage your pharmacy.</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Email address">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-9"
                    placeholder="you@pharmacy.com"
                  />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-9"
                    placeholder="••••••••"
                  />
                </div>
              </Field>
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
              <Button type="submit" size="lg" loading={busy} className="w-full">
                Sign in
              </Button>
            </form>
            <p className="mt-8 text-center text-xs text-slate-400">Forgot your password? Ask your pharmacy administrator to reset it.</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
