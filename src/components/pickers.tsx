"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, UserRound } from "lucide-react";
import { api, useDebounced } from "@/lib/client/api";
import type { Customer, Product } from "@/lib/types";
import { useSession } from "./session";
import { Badge, cn, SearchInput, Spinner } from "./ui";

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return ref;
}

export function ProductPicker({
  onSelect,
  placeholder = "Search medicine by name, generic, SKU or barcode…",
  includeOutOfStock = true,
}: {
  onSelect: (p: Product) => void;
  placeholder?: string;
  includeOutOfStock?: boolean;
}) {
  const { money } = useSession();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const dq = useDebounced(q, 200);
  const ref = useOutsideClose(() => setOpen(false));

  useEffect(() => {
    if (!dq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api<Product[]>(`/api/products?limit=12&q=${encodeURIComponent(dq)}`, { signal: ctrl.signal })
      .then((r) => setResults(includeOutOfStock ? r : r.filter((p) => p.stock > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dq, includeOutOfStock]);

  return (
    <div ref={ref} className="relative">
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setOpen(true);
        }}
        placeholder={placeholder}
      />
      {open && q && (
        <div className="absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {loading && !results.length ? (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          ) : results.length ? (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                  <Pill className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {p.name} <span className="text-slate-500">{p.strength}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[p.genericName, p.dosageForm, p.packSize].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-slate-900">{money(p.sellPrice)}</span>
                  <span className={cn("block text-xs", p.stock > 0 ? "text-slate-500" : "text-rose-600")}>{p.stock} in stock</span>
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-slate-500">No medicines match “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerPicker({
  value,
  onChange,
  placeholder = "Search patient by name, phone or insurance no.…",
}: {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const dq = useDebounced(q, 200);
  const ref = useOutsideClose(() => setOpen(false));

  useEffect(() => {
    if (!dq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    api<Customer[]>(`/api/customers?limit=8&q=${encodeURIComponent(dq)}`, { signal: ctrl.signal })
      .then(setResults)
      .catch(() => {});
    return () => ctrl.abort();
  }, [dq]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-white">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{value.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {[value.phone, value.insuranceProvider && `${value.insuranceProvider} ${value.insuranceCoverage}%`].filter(Boolean).join(" · ") || "No phone"}
          </span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-slate-500 hover:text-rose-600">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setOpen(true);
        }}
        placeholder={placeholder}
      />
      {open && q && (
        <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {results.length ? (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{c.phone || c.email || "—"}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {c.allergies && <Badge tone="rose">Allergies</Badge>}
                  {c.insuranceProvider && <Badge tone="sky">{c.insuranceProvider}</Badge>}
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-slate-500">No patients match “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
