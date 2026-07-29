"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Re-fetches `url` on an interval and replaces the previous value wholesale.
 * For endpoints that always return full current state (mandate, receipts) —
 * see `useIncrementalPoll` for the events feed's append-only pattern.
 */
export function usePolledFetch<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const json: T = await res.json();
        if (cancelled) return;
        setData(json);
        setOk(true);
      } catch {
        if (!cancelled) setOk(false);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, ok };
}

/**
 * Append-only polling for `GET <baseUrl>?since=<lastId>` endpoints — never
 * re-fetches or re-renders the whole list, per docs/06-DASHBOARD-SPEC.md.
 */
export function useIncrementalPoll<T extends { event_id: string }>(baseUrl: string, intervalMs: number) {
  const [items, setItems] = useState<T[]>([]);
  const [ok, setOk] = useState(true);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const url = lastEventId.current ? `${baseUrl}?since=${lastEventId.current}` : baseUrl;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const next: T[] = await res.json();
        if (cancelled) return;
        setOk(true);
        if (next.length === 0) return;
        lastEventId.current = next[next.length - 1].event_id;
        setItems((prev) => [...prev, ...next]);
      } catch {
        if (!cancelled) setOk(false);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [baseUrl, intervalMs]);

  return { items, ok };
}
