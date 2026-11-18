import type { settings as settingsTable } from "@/db/schema";

export type AppSettings = typeof settingsTable.$inferSelect;

type MoneySettings = Pick<AppSettings, "currencyCode" | "currencySymbol" | "currencyDecimals" | "locale">;

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number | string | null | undefined, s: MoneySettings | undefined) {
  const n = Number(value) || 0;
  if (!s) return n.toFixed(2);
  const key = `${s.locale}|${s.currencyCode}|${s.currencyDecimals}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(s.locale || "en-US", {
        style: "currency",
        currency: s.currencyCode || "USD",
        minimumFractionDigits: s.currencyDecimals,
        maximumFractionDigits: s.currencyDecimals,
      });
    } catch {
      fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
    formatterCache.set(key, fmt);
  }
  if (s.currencySymbol) {
    // Custom symbol overrides the ISO symbol while keeping locale grouping.
    const parts = fmt.formatToParts(n);
    return parts.map((p) => (p.type === "currency" ? s.currencySymbol : p.value)).join("");
  }
  return fmt.format(n);
}

export function formatNumber(value: number | string | null | undefined, decimals = 0) {
  return (Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: dateOnly ? "UTC" : tz || undefined,
  });
}

export function formatDateTime(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz || undefined,
  });
}

export function daysUntil(dateISO: string | null | undefined) {
  if (!dateISO) return null;
  const target = new Date(`${dateISO}T00:00:00Z`).getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

export function todayLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function shiftISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AED", name: "UAE Dirham" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "CHF", name: "Swiss Franc" },
];

export function currencyDecimals(code: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
