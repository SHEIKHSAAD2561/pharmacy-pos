"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Settings,
  ShoppingCart,
  Truck,
  Undo2,
  UserCog,
  Users,
  X,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { cn, Spinner } from "./ui";
import { SessionProvider, useSession, type Role } from "./session";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
    ],
  },
  {
    section: "Sales",
    items: [
      { href: "/sales", label: "Sales History", icon: Receipt },
      { href: "/returns", label: "Returns", icon: Undo2 },
      { href: "/shifts", label: "Register Shifts", icon: Clock },
    ],
  },
  {
    section: "Pharmacy",
    items: [
      { href: "/prescriptions", label: "Prescriptions", icon: FileText },
      { href: "/customers", label: "Patients", icon: Users },
    ],
  },
  {
    section: "Inventory",
    items: [
      { href: "/products", label: "Medicines", icon: Pill },
      { href: "/inventory", label: "Stock & Expiry", icon: Boxes },
      { href: "/purchases", label: "Purchase Orders", icon: ClipboardList, roles: ["admin", "pharmacist"] },
      { href: "/suppliers", label: "Suppliers", icon: Truck, roles: ["admin", "pharmacist"] },
    ],
  },
  {
    section: "Business",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "pharmacist"] },
      { href: "/users", label: "Staff", icon: UserCog, roles: ["admin"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden>
          <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{name}</p>
        <p className="text-[11px] font-medium text-emerald-300/80">PharmaPOS</p>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, settings, can } = useSession();
  return (
    <div className="sidebar-bg flex h-full flex-col text-slate-300">
      <div className="px-4 pb-4 pt-5">
        <Brand name={settings.pharmacyName} />
      </div>
      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || can(...i.roles));
          if (!items.length) return null;
          return (
            <div key={group.section}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-white ring-1 ring-inset ring-emerald-400/20"
                            : "text-slate-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className={cn("h-4 w-4", active ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300")} />
                        {item.label}
                        {item.href === "/pos" && (
                          <span className="ml-auto rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">F2</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <UserCard name={user.name} role={user.role} />
    </div>
  );
}

function UserCard({ name, role }: { name: string; role: Role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="m-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        <p className="text-[11px] capitalize text-slate-400">{role}</p>
      </div>
      <button
        onClick={logout}
        disabled={busy}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function Clock12() {
  const { settings } = useSession();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="hidden text-xs font-medium text-slate-500 md:inline">
      {now.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: settings.timezone || undefined,
      })}
    </span>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isPos = pathname === "/pos";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        router.push("/pos");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="app-bg flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-slide-up">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Clock12 />
          <div className="ml-auto flex items-center gap-2">
            {!isPos && (
              <Link
                href="/pos"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 hover:to-emerald-700"
              >
                <ShoppingCart className="h-4 w-4" /> New sale
              </Link>
            )}
          </div>
        </header>
        <main className={cn("flex-1", isPos ? "p-3 sm:p-4" : "p-4 sm:p-6 lg:p-8")}>
          <div className={cn(isPos ? "" : "mx-auto max-w-7xl", "animate-slide-up")}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Spinner className="h-7 w-7" />
        </div>
      }
    >
      <ShellInner>{children}</ShellInner>
    </SessionProvider>
  );
}

export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { can } = useSession();
  if (!can(...roles)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        You do not have access to this page. Ask an administrator if you need it.
      </div>
    );
  }
  return <>{children}</>;
}
