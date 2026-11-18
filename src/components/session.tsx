"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { formatMoney, type AppSettings } from "@/lib/format";

export type Role = "admin" | "pharmacist" | "cashier";
export type User = { id: number; name: string; email: string; role: Role };

type SessionValue = {
  user: User;
  settings: AppSettings;
  money: (n: number | string | null | undefined) => string;
  can: (...roles: Role[]) => boolean;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<{ user: User; settings: AppSettings } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User; settings: AppSettings }>("/api/auth/me");
      setState(data);
    } catch {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (!state) return <>{fallback}</>;

  const value: SessionValue = {
    ...state,
    money: (n) => formatMoney(n, state.settings),
    can: (...roles) => roles.includes(state.user.role),
    refresh,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
