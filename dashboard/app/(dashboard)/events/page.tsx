"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { GateEvent } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { EventTable } from "@/components/events/event-table";
import { useIncrementalPoll } from "@/hooks/use-polling";

const POLL_INTERVAL_MS = 1800;

export default function EventsPage() {
  const { items } = useIncrementalPoll<GateEvent>("/api/events", POLL_INTERVAL_MS);
  const seenCount = useRef(0);

  useEffect(() => {
    // Surface a toast for any newly-arrived DENY — the demo's climax moment
    // deserves a signal beyond a new table row. Real state only: this fires
    // from the same polled data the table renders, never a separate source.
    const fresh = items.slice(seenCount.current);
    seenCount.current = items.length;
    for (const event of fresh) {
      if (event.verdict === "DENY") {
        toast.error(`DENY — ${event.command}`, {
          description: event.code ?? "policy denied",
        });
      }
    }
  }, [items]);

  return (
    <div>
      <PageHeader title="Gate decision log" description="Every ALLOW, DENY, and STEP_UP the policy engine has issued, live." />
      <EventTable events={items} />
    </div>
  );
}
