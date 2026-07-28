'use client';

import { useEffect, useRef, useState } from 'react';
import type { GateEvent } from '@/lib/types';
import { EventRow } from '@/components/EventRow';

const POLL_INTERVAL_MS = 1800;

export default function EventsPage() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const url = lastEventId.current ? `/api/events?since=${lastEventId.current}` : '/api/events';
      const res = await fetch(url);
      const newEvents: GateEvent[] = await res.json();
      if (cancelled || newEvents.length === 0) return;
      lastEventId.current = newEvents[newEvents.length - 1].event_id;
      // Append only what's new — never re-fetch/re-render the whole list, per docs/06-DASHBOARD-SPEC.md.
      setEvents((prev) => [...prev, ...newEvents]);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const reversed = [...events].reverse(); // reverse-chronological, per spec

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Gate decision log</h1>
      {reversed.length === 0 ? (
        <p className="text-zinc-500">No events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-300 text-xs uppercase text-zinc-500 dark:border-zinc-700">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Command</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Run ID</th>
              </tr>
            </thead>
            <tbody>
              {reversed.map((e) => (
                <EventRow key={e.event_id} event={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
