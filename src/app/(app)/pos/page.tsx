"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Barcode,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Minus,
  Pill,
  Plus,
  Printer,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Split,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerFormModal } from "@/components/customer-form";
import { CustomerPicker } from "@/components/pickers";
import { Receipt, type SaleDetail } from "@/components/receipt";
import { useSession } from "@/components/session";
import { Badge, Button, Card, cn, EmptyState, Field, Input, Modal, SearchInput, Spinner, Switch } from "@/components/ui";
import { api, useApi, useDebounced } from "@/lib/client/api";
import { daysUntil, formatDate } from "@/lib/format";
import type { Category, Customer, PrescriptionDetail, PrescriptionListItem, Product, Quote } from "@/lib/types";

type CartLine = { product: Product; quantity: number; discount: number };

const CATEGORY_DOT: Record<string, string> = {
  rose: "bg-rose-500", violet: "bg-violet-500", red: "bg-red-500", blue: "bg-blue-500", cyan: "bg-cyan-500",
  amber: "bg-amber-500", lime: "bg-lime-500", emerald: "bg-emerald-500", pink: "bg-pink-500", sky: "bg-sky-500",
  teal: "bg-teal-500", slate: "bg-slate-500",
};

export default function PosPage() {
  const { settings, money, user, can } = useSession();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const dq = useDebounced(q, 200);
  const productsUrl = `/api/products?limit=60${dq ? `&q=${encodeURIComponent(dq)}` : ""}${categoryId ? `&categoryId=${categoryId}` : ""}`;
  const { data: products, loading: productsLoading, reload: reloadProducts } = useApi<Product[]>(productsUrl);
  const { data: categories } = useApi<Category[]>("/api/categories");
  const shift = useApi<{ shift: { id: number; openingCash: number } | null }>("/api/shifts/current");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [useInsurance, setUseInsurance] = useState(true);
  const [usePoints, setUsePoints] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);
  const [scan, setScan] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const grossTotal = cart.reduce((s, l) => s + l.product.sellPrice * l.quantity - l.discount, 0);
  const orderDiscount =
    discountMode === "percent"
      ? Math.round(grossTotal * Math.min(100, Number(discountInput) || 0)) / 100
      : Number(discountInput) || 0;

  /* ---------------- cart operations ---------------- */

  const addToCart = useCallback(
    (p: Product, qty = 1) => {
      if (p.stock <= 0) {
        toast.error(`${p.name} is out of stock`);
        return;
      }
      setCart((prev) => {
        const existing = prev.find((l) => l.product.id === p.id);
        if (existing) {
          const next = Math.min(existing.quantity + qty, p.stock);
          if (next === existing.quantity) toast.warning(`Only ${p.stock} of ${p.name} in stock`);
          return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: next } : l));
        }
        return [...prev, { product: p, quantity: Math.min(qty, p.stock), discount: 0 }];
      });
    },
    [],
  );

  const setQty = (id: number, qty: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, Math.min(qty, l.product.stock)) } : l))
        .filter((l) => l.quantity > 0),
    );

  const clearSale = useCallback(() => {
    setCart([]);
    setCustomer(null);
    setPrescription(null);
    setDiscountInput("");
    setUsePoints(false);
    setQuote(null);
  }, []);

  /* ---------------- live quote ---------------- */

  const quotePayload = useMemo(
    () => ({
      customerId: customer?.id ?? null,
      items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, discount: l.discount })),
      discount: orderDiscount,
      useInsurance,
      pointsToRedeem: usePoints && customer ? customer.loyaltyPoints : 0,
    }),
    [cart, customer, orderDiscount, useInsurance, usePoints],
  );
  const debouncedPayload = useDebounced(quotePayload, 150);

  useEffect(() => {
    if (!debouncedPayload.items.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const ctrl = new AbortController();
    setQuoting(true);
    api<Quote>("/api/sales/quote", { body: debouncedPayload, signal: ctrl.signal })
      .then((q) => {
        setQuote(q);
        setQuoteError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setQuoteError((e as Error).message);
      })
      .finally(() => setQuoting(false));
    return () => ctrl.abort();
  }, [debouncedPayload]);

  /* ---------------- barcode scanning & shortcuts ---------------- */

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    setScan("");
    try {
      const found = await api<Product[]>(`/api/products?limit=5&q=${encodeURIComponent(code)}`);
      const exact = found.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
      const match = exact ?? (found.length === 1 ? found[0] : null);
      if (match) addToCart(match);
      else if (found.length) {
        setQ(code);
        toast.info("Several medicines match — pick one from the list");
      } else toast.error(`No medicine with code ${code}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    scanRef.current?.focus();
  }

  const rxRequiredMissing =
    settings.requirePrescriptionCheck && !prescription && cart.some((l) => l.product.requiresPrescription);
  const controlledBlocked = user.role === "cashier" && cart.some((l) => l.product.controlled);
  const canPay = cart.length > 0 && !!quote && !quoteError && !rxRequiredMissing && !controlledBlocked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F4" && canPay) {
        e.preventDefault();
        setPayOpen(true);
      }
      if (e.key === "F8") {
        e.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPay]);

  /* ---------------- prescriptions ---------------- */

  const loadPrescription = useCallback(
    async (id: number) => {
      try {
        const rx = await api<PrescriptionDetail>(`/api/prescriptions/${id}`);
        if (rx.status !== "pending") {
          toast.error(`Prescription ${rx.code} is ${rx.status}`);
          return;
        }
        setPrescription(rx);
        setCustomer(rx.customer);
        const found = await Promise.all(rx.items.map((i) => api<Product>(`/api/products/${i.productId}`)));
        const byId = new Map(found.map((p) => [p.id, p]));
        const lines: CartLine[] = [];
        for (const item of rx.items) {
          const p = byId.get(item.productId);
          if (!p) continue;
          if (p.stock < item.quantity) toast.warning(`${p.name}: only ${p.stock} in stock (prescribed ${item.quantity})`);
          if (p.stock > 0) lines.push({ product: p, quantity: Math.min(item.quantity, p.stock), discount: 0 });
        }
        setCart(lines);
        toast.success(`Prescription ${rx.code} loaded for ${rx.customer.name}`);
        if (rx.warnings.length) toast.warning(rx.warnings[0], { duration: 8000 });
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [],
  );

  useEffect(() => {
    const rxId = Number(new URLSearchParams(window.location.search).get("rx"));
    if (rxId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPrescription(rxId);
      window.history.replaceState(null, "", "/pos");
    }
  }, [loadPrescription]);

  async function onSaleComplete(saleId: number) {
    setPayOpen(false);
    try {
      const detail = await api<SaleDetail>(`/api/sales/${saleId}`);
      setCompletedSale(detail);
    } catch {
      toast.success("Sale completed");
    }
    clearSale();
    reloadProducts();
    shift.reload();
  }

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_430px]">
      {/* ------------------------------------------------ Catalog */}
      <div className="min-w-0 space-y-4">
        {!shift.loading && !shift.data?.shift && <OpenShiftBanner onOpened={shift.reload} />}

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <form onSubmit={handleScan} className="relative md:w-72">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              <Input
                ref={scanRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan barcode or SKU (F8)"
                className="pl-9 font-mono"
                autoFocus
              />
            </form>
            <SearchInput value={q} onChange={setQ} placeholder="Search medicines by name or generic…" className="flex-1" />
          </div>
          <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
            <CategoryChip active={categoryId === 0} onClick={() => setCategoryId(0)} label="All" />
            {categories?.map((c) => (
              <CategoryChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} label={c.name} dot={CATEGORY_DOT[c.color]} />
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {productsLoading && !products ? (
            <div className="col-span-full flex justify-center py-16">
              <Spinner />
            </div>
          ) : products?.length ? (
            products.map((p) => {
              const inCart = cart.find((l) => l.product.id === p.id)?.quantity ?? 0;
              const days = daysUntil(p.nextExpiry);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
                    p.stock > 0 ? "border-slate-200/80 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md" : "cursor-not-allowed border-slate-200/60 opacity-55",
                    inCart > 0 && "border-emerald-400 ring-2 ring-emerald-500/20",
                  )}
                >
                  {inCart > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white shadow">
                      {inCart}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                      <Pill className="h-4 w-4" />
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {p.controlled ? <Badge tone="violet">CD</Badge> : p.requiresPrescription && <Badge tone="sky">Rx</Badge>}
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">{[p.strength, p.dosageForm].filter(Boolean).join(" · ") || p.genericName}</p>
                  <div className="mt-auto flex items-end justify-between pt-3">
                    <span className="text-base font-bold text-slate-900">{money(p.sellPrice)}</span>
                    <span className={cn("text-[11px] font-medium", p.stock <= 0 ? "text-rose-600" : p.stock <= p.reorderLevel ? "text-amber-600" : "text-slate-500")}>
                      {p.stock <= 0 ? "Out" : `${p.stock} left`}
                    </span>
                  </div>
                  {days !== null && days <= settings.expiryAlertDays && p.stock > 0 && (
                    <span className="mt-1.5 text-[10px] font-medium text-amber-600">Next batch expires in {days}d</span>
                  )}
                </button>
              );
            })
          ) : (
            <Card className="col-span-full">
              <EmptyState icon={<Pill className="h-5 w-5" />} title="No medicines found" description="Try another search or category." />
            </Card>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ Cart */}
      <div id="cart" className="scroll-mt-16 xl:sticky xl:top-[4.5rem] xl:h-[calc(100vh-5.5rem)]">
        <Card className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 text-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold">Current sale</span>
              {cartCount > 0 && <span className="rounded-full bg-emerald-500 px-2 text-xs font-bold">{cartCount}</span>}
            </div>
            {cart.length > 0 && (
              <button onClick={clearSale} className="text-xs font-medium text-slate-300 hover:text-white">
                Clear
              </button>
            )}
          </div>

          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <CustomerPicker
                  value={customer}
                  onChange={(c) => {
                    setCustomer(c);
                    if (!c) {
                      setPrescription(null);
                      setUsePoints(false);
                    }
                  }}
                />
              </div>
              {!customer && (
                <Button variant="outline" size="icon" onClick={() => setNewCustomerOpen(true)} title="New patient" aria-label="New patient">
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
            {customer?.allergies && (
              <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" /> Allergies: {customer.allergies}
              </p>
            )}
            {prescription ? (
              <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-inset ring-sky-200">
                <FileText className="h-3.5 w-3.5" />
                <span className="flex-1">
                  <b>{prescription.code}</b> · {prescription.doctorName}
                </span>
                <button onClick={() => setPrescription(null)} className="rounded p-0.5 hover:bg-sky-100" aria-label="Detach prescription">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRxOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700"
              >
                <FileText className="h-3.5 w-3.5" /> Attach prescription
              </button>
            )}
          </div>

          <div className="scrollbar-thin min-h-[160px] flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Cart is empty" description="Scan a barcode or tap a medicine to add it." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((l) => {
                  const line = quote?.lines.find((x) => x.productId === l.product.id);
                  return (
                    <li key={l.product.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {l.product.name} <span className="font-normal text-slate-500">{l.product.strength}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {money(l.product.sellPrice)} each
                            {l.product.requiresPrescription && !prescription && settings.requirePrescriptionCheck && (
                              <span className="ml-1.5 font-semibold text-sky-700">· Needs prescription</span>
                            )}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{money(line?.total ?? l.product.sellPrice * l.quantity - l.discount)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                          <button onClick={() => setQty(l.product.id, l.quantity - 1)} className="grid h-8 w-8 place-items-center text-slate-500 hover:text-slate-900" aria-label="Decrease">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            value={l.quantity}
                            onChange={(e) => setQty(l.product.id, Number(e.target.value.replace(/\D/g, "")) || 0)}
                            className="h-8 w-10 border-x border-slate-200 text-center text-sm font-semibold focus:outline-none"
                            inputMode="numeric"
                            aria-label="Quantity"
                          />
                          <button onClick={() => setQty(l.product.id, l.quantity + 1)} className="grid h-8 w-8 place-items-center text-slate-500 hover:text-slate-900" aria-label="Increase">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="relative w-24">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-slate-400">Disc</span>
                          <input
                            value={l.discount || ""}
                            onChange={(e) =>
                              setCart((prev) =>
                                prev.map((x) => (x.product.id === l.product.id ? { ...x, discount: Math.max(0, Number(e.target.value) || 0) } : x)),
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-8 w-full rounded-xl border border-slate-200 pl-10 pr-2 text-right text-sm focus:border-emerald-500 focus:outline-none"
                            aria-label="Line discount"
                          />
                        </div>
                        <button onClick={() => setQty(l.product.id, 0)} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-semibold">
                {(["amount", "percent"] as const).map((m) => (
                  <button key={m} onClick={() => setDiscountMode(m)} className={cn("rounded-md px-2 py-1", discountMode === m ? "bg-white shadow-sm" : "text-slate-500")}>
                    {m === "amount" ? settings.currencySymbol || settings.currencyCode : "%"}
                  </button>
                ))}
              </div>
              <Input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                inputMode="decimal"
                placeholder="Order discount"
                className="h-8 flex-1 text-right"
              />
            </div>
            {customer && (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {customer.insuranceProvider && customer.insuranceCoverage > 0 && (
                  <Switch checked={useInsurance} onChange={setUseInsurance} label={`Bill ${customer.insuranceProvider} (${customer.insuranceCoverage}% of Rx)`} />
                )}
                {settings.loyaltyEnabled && customer.loyaltyPoints > 0 && (
                  <Switch checked={usePoints} onChange={setUsePoints} label={`Redeem ${customer.loyaltyPoints} points`} />
                )}
              </div>
            )}

            {quote?.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
              </p>
            ))}
            {quoteError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{quoteError}</p>}

            <dl className="space-y-1 text-sm">
              <Line label="Subtotal" value={money(quote?.subtotal ?? 0)} />
              {(quote?.discount ?? 0) > 0 && <Line label="Discounts" value={`−${money(quote!.discount)}`} />}
              {settings.taxRate > 0 && (
                <Line label={`${settings.taxName} ${settings.taxRate}%${settings.pricesIncludeTax ? " (included)" : ""}`} value={money(quote?.tax ?? 0)} />
              )}
              {(quote?.insuranceAmount ?? 0) > 0 && <Line label="Insurance pays" value={`−${money(quote!.insuranceAmount)}`} accent />}
              {(quote?.pointsValue ?? 0) > 0 && <Line label={`Points (${quote!.pointsRedeemed})`} value={`−${money(quote!.pointsValue)}`} accent />}
            </dl>
            <div className="flex items-end justify-between border-t border-dashed border-slate-300 pt-3">
              <span className="text-sm font-semibold text-slate-600">Amount due</span>
              <span className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
                {quoting && <Spinner className="h-4 w-4" />}
                {money(quote?.amountDue ?? 0)}
              </span>
            </div>
            {rxRequiredMissing && (
              <p className="text-xs font-medium text-sky-700">Attach a prescription to sell prescription-only medicines.</p>
            )}
            {controlledBlocked && <p className="text-xs font-medium text-violet-700">Controlled drugs must be dispensed by a pharmacist.</p>}
            <Button size="lg" className="h-14 w-full text-base" disabled={!canPay} onClick={() => setPayOpen(true)}>
              <Banknote className="h-5 w-5" /> Charge {money(quote?.amountDue ?? 0)}
              <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">F4</span>
            </Button>
          </div>
        </Card>
      </div>

      {cart.length > 0 && (
        <button
          onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}
          className="no-print fixed inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-2xl xl:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4 text-emerald-300" /> {cartCount} item{cartCount === 1 ? "" : "s"} · View cart
          </span>
          <span className="text-lg font-bold">{money(quote?.amountDue ?? 0)}</span>
        </button>
      )}

      {payOpen && quote && (
        <PaymentModal
          amountDue={quote.amountDue}
          onClose={() => setPayOpen(false)}
          payload={{ ...quotePayload, prescriptionId: prescription?.id ?? null }}
          onComplete={onSaleComplete}
        />
      )}
      {rxOpen && (
        <PrescriptionPicker
          customerId={customer?.id}
          onClose={() => setRxOpen(false)}
          onPick={(id) => {
            setRxOpen(false);
            loadPrescription(id);
          }}
          canCreate={can("admin", "pharmacist")}
        />
      )}
      {newCustomerOpen && (
        <CustomerFormModal open onClose={() => setNewCustomerOpen(false)} onSaved={(c) => setCustomer(c)} />
      )}
      {completedSale && <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />}
    </div>
  );
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("font-medium", accent ? "text-emerald-700" : "text-slate-800")}>{value}</dd>
    </div>
  );
}

function CategoryChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
        active ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full", dot)} />}
      {label}
    </button>
  );
}

function OpenShiftBanner({ onOpened }: { onOpened: () => void }) {
  const { money } = useSession();
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("0");
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      await api("/api/shifts", { body: { openingCash: Number(cash) || 0 } });
      toast.success("Shift opened");
      setOpen(false);
      onOpened();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <p className="flex-1 text-sm text-amber-900">
          <b>No open register shift.</b> Open one to track your cash drawer and reconcile at the end of the day.
        </p>
        <Button size="sm" variant="dark" onClick={() => setOpen(true)}>
          Open shift
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Open register shift"
        description="Count the cash in the drawer before you start."
        footer={
          <Button onClick={start} loading={busy}>
            Open shift
          </Button>
        }
      >
        <Field label="Opening cash" hint={`Starting float: ${money(Number(cash) || 0)}`}>
          <Input type="number" min={0} step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}

function PaymentModal({
  amountDue,
  payload,
  onClose,
  onComplete,
}: {
  amountDue: number;
  payload: Record<string, unknown>;
  onClose: () => void;
  onComplete: (saleId: number) => void;
}) {
  const { money, settings } = useSession();
  const [method, setMethod] = useState<"cash" | "card" | "split">(amountDue === 0 ? "cash" : "cash");
  const [cash, setCash] = useState(amountDue.toFixed(settings.currencyDecimals));
  const [card, setCard] = useState("");
  const [other, setOther] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const payments =
    method === "cash"
      ? { cash: Number(cash) || 0, card: 0, other: 0 }
      : method === "card"
        ? { cash: 0, card: amountDue, other: 0 }
        : { cash: Number(cash) || 0, card: Number(card) || 0, other: Number(other) || 0 };
  const paid = payments.cash + payments.card + payments.other;
  const change = Math.max(0, paid - amountDue);
  const short = Math.max(0, amountDue - paid);

  const quick = useMemo(() => {
    const steps = [5, 10, 20, 50, 100, 200, 500];
    const set = new Set<number>([amountDue]);
    for (const s of steps) {
      const v = Math.ceil(amountDue / s) * s;
      if (v > amountDue) set.add(v);
      if (set.size >= 5) break;
    }
    return [...set];
  }, [amountDue]);

  async function complete() {
    setBusy(true);
    try {
      const res = await api<{ id: number; invoiceNo: string; changeGiven: number }>("/api/sales", {
        body: { ...payload, payments, paymentReference: reference, notes },
      });
      toast.success(`Sale ${res.invoiceNo} completed${res.changeGiven > 0 ? ` · change ${money(res.changeGiven)}` : ""}`);
      onComplete(res.id);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Take payment"
      footer={
        <Button size="lg" onClick={complete} loading={busy} disabled={short > 0.0001} className="w-full sm:w-auto">
          <CheckCircle2 className="h-5 w-5" /> Complete sale
        </Button>
      }
    >
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Amount due</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{money(amountDue)}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(
          [
            ["cash", "Cash", Banknote],
            ["card", "Card", CreditCard],
            ["split", "Split / other", Split],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setMethod(key)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-sm font-semibold transition",
              method === key ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20" : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {method === "cash" && (
          <>
            <Field label="Cash received">
              <Input type="number" step="0.01" min={0} value={cash} onChange={(e) => setCash(e.target.value)} autoFocus className="h-12 text-lg font-semibold" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quick.map((v) => (
                <Button key={v} variant="outline" size="sm" onClick={() => setCash(v.toFixed(settings.currencyDecimals))}>
                  {v === amountDue ? "Exact" : money(v)}
                </Button>
              ))}
            </div>
          </>
        )}
        {method === "card" && (
          <Field label="Card reference" hint="Last 4 digits or terminal approval code (optional).">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} autoFocus placeholder="e.g. VISA 4242 · Auth 839201" />
          </Field>
        )}
        {method === "split" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cash">
              <Input type="number" step="0.01" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
            </Field>
            <Field label="Card">
              <Input type="number" step="0.01" min={0} value={card} onChange={(e) => setCard(e.target.value)} />
            </Field>
            <Field label="Other (wallet, transfer)">
              <Input type="number" step="0.01" min={0} value={other} onChange={(e) => setOther(e.target.value)} />
            </Field>
            <Field label="Reference" className="sm:col-span-3">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Card or transfer reference" />
            </Field>
          </div>
        )}
        <Field label="Note on receipt (optional)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
            <p className="text-xs font-medium text-slate-500">Paid</p>
            <p className="text-xl font-bold text-slate-900">{money(paid)}</p>
          </div>
          <div className={cn("rounded-2xl p-4 ring-1 ring-inset", short > 0 ? "bg-rose-50 ring-rose-200" : "bg-emerald-50 ring-emerald-200")}>
            <p className={cn("text-xs font-medium", short > 0 ? "text-rose-600" : "text-emerald-700")}>{short > 0 ? "Still due" : "Change"}</p>
            <p className={cn("text-xl font-bold", short > 0 ? "text-rose-700" : "text-emerald-700")}>{money(short > 0 ? short : change)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PrescriptionPicker({
  customerId,
  onClose,
  onPick,
  canCreate,
}: {
  customerId?: number;
  onClose: () => void;
  onPick: (id: number) => void;
  canCreate: boolean;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const { data, loading } = useApi<PrescriptionListItem[]>(
    `/api/prescriptions?status=pending${customerId ? `&customerId=${customerId}` : ""}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Attach a prescription"
      description="Pick a pending prescription to load its medicines into the cart."
      footer={
        canCreate ? (
          <Link href="/prescriptions/new" className="text-sm font-semibold text-emerald-700 hover:underline">
            Record a new prescription →
          </Link>
        ) : undefined
      }
    >
      <SearchInput value={q} onChange={setQ} placeholder="Search by code, patient or doctor…" autoFocus />
      <div className="mt-4 space-y-2">
        {loading && !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : data?.length ? (
          data.map((rx) => (
            <button
              key={rx.id}
              onClick={() => onPick(rx.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {rx.code} · {rx.customerName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {rx.doctorName}
                  {rx.clinic && `, ${rx.clinic}`} · {formatDate(rx.issueDate)} · {rx.itemCount} item{rx.itemCount === 1 ? "" : "s"}
                </span>
              </span>
              <ShieldCheck className="h-4 w-4 text-slate-300" />
            </button>
          ))
        ) : (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No pending prescriptions" description={customerId ? "This patient has no prescriptions waiting." : undefined} />
        )}
      </div>
    </Modal>
  );
}

function ReceiptModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { settings, money } = useSession();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" /> Sale complete
        </span>
      }
      description={`${sale.invoiceNo}${sale.changeGiven > 0 ? ` · Give change: ${money(sale.changeGiven)}` : ""}`}
      footer={
        <>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
          <Button onClick={onClose} autoFocus>
            New sale
          </Button>
        </>
      }
    >
      {sale.changeGiven > 0 && (
        <div className="no-print mb-4 rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-inset ring-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Change due</p>
          <p className="text-3xl font-bold text-emerald-700">{money(sale.changeGiven)}</p>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <Receipt sale={sale} settings={settings} />
      </div>
    </Modal>
  );
}
