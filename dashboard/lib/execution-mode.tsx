"use client";

// The Purchase Mode toggle's state, shared across the whole shop flow.
//
// Both modes run the identical pipeline — real search, real add-to-cart, real cart verification,
// real mandate gate, real Dodo test-reserve draw, real signed receipt. The ONLY difference is
// whether the merchant's own checkout is driven to a placed order. See
// src/receipt/execution-mode.ts for the authoritative explanation.
//
// Default is TEST, deliberately: a click in a browser must never place a real order just because
// nobody changed a setting. LIVE is always an explicit choice.
//
// Persisted in sessionStorage rather than localStorage so the choice doesn't silently outlive the
// browser session — same reasoning as lib/shop-session.ts. A stale LIVE from days ago is exactly the
// kind of thing that should not survive quietly.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ExecutionMode = "TEST" | "LIVE";

const STORAGE_KEY = "vitta-execution-mode";
export const DEFAULT_MODE: ExecutionMode = "TEST";

interface ExecutionModeContextValue {
  mode: ExecutionMode;
  setMode: (mode: ExecutionMode) => void;
  /** False until sessionStorage has been read, so the UI can avoid flashing the default before the
   *  restored value arrives. */
  hydrated: boolean;
}

const ExecutionModeContext = createContext<ExecutionModeContextValue | null>(null);

function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === "TEST" || value === "LIVE";
}

export function ExecutionModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ExecutionMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Deferred to an effect (not a lazy initializer) so SSR and the first client render match —
    // sessionStorage doesn't exist during SSR. Same pattern as theme-provider.tsx.
    let restored: ExecutionMode | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (isExecutionMode(raw)) restored = raw;
    } catch {
      // Storage unavailable — stay on the safe default.
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restored) setModeState(restored);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setMode = useCallback((next: ExecutionMode) => {
    setModeState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal — the mode still applies for this page's lifetime.
    }
  }, []);

  return (
    <ExecutionModeContext.Provider value={{ mode, setMode, hydrated }}>{children}</ExecutionModeContext.Provider>
  );
}

export function useExecutionMode(): ExecutionModeContextValue {
  const ctx = useContext(ExecutionModeContext);
  if (!ctx) throw new Error("useExecutionMode must be used within ExecutionModeProvider");
  return ctx;
}

/** Presentation details for a mode, kept in one place so the toggle, the cart's confirm dialog, the
 *  timeline and the result page can never describe the same mode differently. */
export const MODE_META: Record<ExecutionMode, { label: string; dot: string; blurb: string }> = {
  TEST: {
    label: "Test Mode",
    dot: "🟢",
    blurb: "Settles against your real Dodo test reserve. No merchant order is placed.",
  },
  LIVE: {
    label: "Live Mode",
    dot: "🔴",
    blurb: "Drives the real merchant checkout and places a real order.",
  },
};
