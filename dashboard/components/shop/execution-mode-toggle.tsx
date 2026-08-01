"use client";

// The Test/Live segmented control, plus a compact read-only badge for surfaces that must SHOW the
// active mode without offering to change it mid-run (the purchase timeline and result page).
//
// Deliberately explicit about consequences: switching to Live is a real-money decision, so the
// control states what each mode does rather than relying on the user remembering.
import { useExecutionMode, MODE_META, type ExecutionMode } from "@/lib/execution-mode";

const MODES: ExecutionMode[] = ["TEST", "LIVE"];

export function ExecutionModeToggle({ className = "" }: { className?: string }) {
  const { mode, setMode, hydrated } = useExecutionMode();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="text-[10px] tracking-widest text-ink-faint uppercase">Execution mode</div>
      <div
        role="radiogroup"
        aria-label="Execution mode"
        className="inline-flex w-fit border border-border bg-card p-0.5"
      >
        {MODES.map((m) => {
          const active = hydrated && mode === m;
          const isLive = m === "LIVE";
          return (
            <button
              key={m}
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? isLive
                    ? "bg-deny/15 text-deny"
                    : "bg-allow/15 text-allow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span aria-hidden>{MODE_META[m].dot}</span>
              {MODE_META[m].label}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">{MODE_META[mode].blurb}</div>
    </div>
  );
}

/** Read-only indicator. `mode` is passed in rather than read from context, because on a result page
 *  the mode that matters is the one the RUN used — a job's recorded mode, not whatever the toggle
 *  happens to say now. */
export function ExecutionModeBadge({ mode, className = "" }: { mode: ExecutionMode; className?: string }) {
  const meta = MODE_META[mode];
  const tone = mode === "LIVE" ? "border-deny/30 bg-deny/10 text-deny" : "border-allow/30 bg-allow/10 text-allow";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium ${tone} ${className}`}
    >
      <span aria-hidden>{meta.dot}</span>
      {meta.label}
    </span>
  );
}
