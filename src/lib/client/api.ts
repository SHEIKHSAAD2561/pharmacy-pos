"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ClientApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    const next = encodeURIComponent(window.location.pathname);
    // Hard redirect: the session expired, so drop all client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${next}`);
  }
  if (!res.ok) throw new ClientApiError((data as { error?: string }).error ?? "Request failed", res.status);
  return data as T;
}

/** Fetches JSON from an API route and keeps it in state. Pass null to skip. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const counter = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++counter.current;
    setLoading(true);
    try {
      const result = await api<T>(url);
      if (id === counter.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === counter.current) setError((e as Error).message);
    } finally {
      if (id === counter.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
