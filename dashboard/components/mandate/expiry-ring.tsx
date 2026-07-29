"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SIZE = 88;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Mandates in this product are same-day by design (e.g. "before 6:00 PM
// today" — see docs/05-DEMO-SCRIPT.md), so a 24h window is a reasonable,
// non-fabricated reference for "how full the ring reads" — the underlying
// countdown is always the real expires_at, only this visual reference frame
// is a design choice.
const REFERENCE_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "expired";
  const totalMinutes = Math.floor(msLeft / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((msLeft % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function ExpiryRing({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Deliberately deferred to an effect rather than a lazy useState
    // initializer: Date.now() must stay null through SSR/first paint so the
    // server-rendered markup and the client's first render match — filling
    // it in immediately post-mount, then ticking, is the correct pattern
    // here despite the lint rule's general preference against setState in
    // effects (see hooks/use-mobile.ts for the same, shadcn-authored shape).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    // Avoid a server/client countdown mismatch on first paint.
    return <div className="size-[88px] shrink-0 rounded-full border border-dashed border-border" />;
  }

  const msLeft = new Date(expiresAt).getTime() - now;
  const expired = msLeft <= 0;
  const fraction = Math.max(0, Math.min(1, msLeft / REFERENCE_WINDOW_MS));
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div className="relative flex size-[88px] shrink-0 items-center justify-center">
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={expired ? "var(--color-deny)" : "var(--color-seal)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className={cn("font-mono text-[11px] tabular-nums", expired ? "text-deny" : "text-foreground")}>
          {formatCountdown(msLeft)}
        </span>
        <span className="text-[9px] tracking-wide text-ink-faint uppercase">left</span>
      </div>
    </div>
  );
}
