"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";

export interface ActivityBar {
  label: string;
  amountInr: number;
  kind: "real" | "sample";
}

// Real = allow-green (already this app's reserved "confirmed/good" status
// color — reused here on purpose, not a new hue). Sample = ink-faint with a
// diagonal hatch texture, a CVD-safe secondary encoding per the dataviz
// skill's mark specs, so the real/sample distinction never depends on color
// alone. Both are existing, already-accessibility-reviewed tokens (see
// DESIGN.md § Accessibility Notes) — not a new categorical palette, so no
// separate validator run is needed here.
function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ActivityBar;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs shadow-none">
      <div className="font-semibold text-foreground">{label}</div>
      <div className="mt-1 font-mono tabular-nums text-muted-foreground">₹{point.amountInr.toLocaleString("en-IN")}</div>
      <div className="mt-0.5 text-[10px] font-medium tracking-wide text-ink-faint uppercase">
        {point.kind === "real" ? "Real receipt" : "Sample projection"}
      </div>
    </div>
  );
}

export function CheckoutActivityChart({ data }: { data: ActivityBar[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-allow" />
          Real receipt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-[2px] border border-ink-faint/60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--ink-faint) 0, var(--ink-faint) 1px, transparent 1px, transparent 4px)",
            }}
          />
          Sample projection
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barCategoryGap="24%">
          <defs>
            <pattern id="sample-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--ink-faint)" fillOpacity={0.18} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-faint)" strokeWidth={2} />
            </pattern>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => `₹${v}`}
          />
          <Tooltip content={CustomTooltip} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="amountInr" radius={[3, 3, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.kind === "real" ? "var(--color-allow)" : "url(#sample-hatch)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
