// The text to show a person when a spawned `gate` command failed.
//
// The gate writes its own failure reason to STDERR ("✗ Execution failed: webcmd exited 2 — …") but may
// already have printed success-looking lines to STDOUT before it failed: an "ALLOW blinkit/…" for the
// write it then could not perform, or "captured 1 authorized payment" before a funding check refused.
// Callers used `stdout || stderr`, so any earlier stdout line hid the real reason — a failed add-to-cart
// showed only "ALLOW … · ₹0" (found live, 2026-09-20). This prefers the reason.
//
// A policy refusal is different: a DENY is a normal decision, printed to stdout with stderr empty, so
// it comes through unchanged. When both exist, the verdict line is kept above the reason.
// Pure — no imports — so scripts/check-gate-failure.js can load it directly.
export function describeGateFailure(stdout: string, stderr: string, fallback: string): string {
  const out = stdout.trim();
  const reasons = stderr
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*✗\s*/, "").trim())
    .filter(Boolean);
  if (reasons.length === 0) return out || fallback;

  const verdict = out.split(/\r?\n/).find((line) => /\b(?:DENY|STEP_UP)\b/.test(line));
  return verdict ? `${verdict.replace(/^\s*✗\s*/, "").trim()}\n${reasons.join("\n")}` : reasons.join("\n");
}
