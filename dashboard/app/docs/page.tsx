"use client";

import { useEffect, useState } from "react";
import { AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/docs/code-block";

// ─── Typography helpers ───────────────────────────────────────────────────────

/** Inline code — soft rounded, Prava-style */
function IC({ children }: { children: React.ReactNode }) {
  return (
    <code className="mx-0.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground border border-border/60">
      {children}
    </code>
  );
}

/** Body paragraph */
function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-4 text-[15px] text-muted-foreground leading-7", className)}>
      {children}
    </p>
  );
}

// ─── Flag table — Prava-style ──────────────────────────────────────────────────

interface Flag {
  flag: string;
  required?: boolean;
  description: string;
}

function FlagTable({ flags }: { flags: Flag[] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-muted-foreground">
              Flag
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-muted-foreground">
              Required
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-muted-foreground">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f, i) => (
            <tr
              key={f.flag}
              className={cn(
                "border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-muted/20",
              )}
            >
              <td className="px-4 py-3 font-mono text-[12px] text-seal whitespace-nowrap">
                {f.flag}
              </td>
              <td className="px-4 py-3 text-[13px]">
                {f.required ? (
                  <span className="inline-flex items-center rounded-full bg-deny/10 px-2 py-0.5 text-[11px] font-semibold text-deny">
                    Required
                  </span>
                ) : (
                  <span className="text-ink-faint text-[13px]">Optional</span>
                )}
              </td>
              <td className="px-4 py-3 text-[13px] text-muted-foreground leading-relaxed">
                {f.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Callout — rounded, Prava-style ───────────────────────────────────────────

type CalloutType = "info" | "tip" | "warning";

const CALLOUT = {
  info: {
    border: "border-seal/40",
    bg: "bg-seal/[0.06]",
    icon: "ℹ",
    iconColor: "text-seal",
    label: "Note",
    labelColor: "text-seal",
  },
  tip: {
    border: "border-allow/40",
    bg: "bg-allow/[0.07]",
    icon: "💡",
    iconColor: "text-allow",
    label: "Tip",
    labelColor: "text-allow",
  },
  warning: {
    border: "border-step-up/40",
    bg: "bg-step-up/[0.07]",
    icon: "⚠",
    iconColor: "text-step-up",
    label: "Warning",
    labelColor: "text-step-up",
  },
} as const;

function Callout({ type = "info", children }: { type?: CalloutType; children: React.ReactNode }) {
  const s = CALLOUT[type];
  return (
    <div
      className={cn(
        "my-5 flex gap-3 rounded-xl border px-4 py-4 text-[14px] leading-relaxed text-muted-foreground",
        s.border,
        s.bg
      )}
    >
      <span className={cn("mt-0.5 shrink-0 text-base leading-none", s.iconColor)}>
        {s.icon}
      </span>
      <div>
        <span className={cn("font-semibold", s.labelColor)}>{s.label}: </span>
        {children}
      </div>
    </div>
  );
}

// ─── Section headings ─────────────────────────────────────────────────────────

function DocH2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      data-doc-heading="true"
      className="mt-14 mb-1 scroll-mt-24 font-heading text-[24px] font-bold tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

function DocH3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-7 mb-2 scroll-mt-24 text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground"
    >
      {children}
    </h3>
  );
}

// ─── Left navigation ──────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: "Getting Started",
    items: [
      { id: "overview", title: "Introduction" },
      { id: "quick-start", title: "Quick start" },
      { id: "architecture", title: "Architecture" },
    ],
  },
  {
    label: "CLI Reference",
    items: [
      { id: "gate-scan", title: "gate scan" },
      { id: "gate-mandate-create", title: "gate mandate create" },
      { id: "gate-mandate-resign", title: "gate mandate resign" },
      { id: "gate-fund", title: "gate fund" },
      { id: "gate-run", title: "gate run" },
      { id: "gate-receipt-show", title: "gate receipt show" },
      { id: "gate-verify", title: "gate verify" },
    ],
  },
  {
    label: "Concepts",
    items: [
      { id: "policy-engine", title: "Policy engine" },
      { id: "ed25519-signing", title: "Ed25519 signing" },
      { id: "receipt-chain", title: "Receipt chain" },
    ],
  },
];

function DocLeftNav({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          {/* Category label */}
          <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
            {section.label}
          </div>
          {/* Items */}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "w-full rounded-md text-left px-2 py-1.5 text-sm transition-all duration-200",
                  activeId === item.id
                    ? "bg-[#00c951]/10 text-[#00c951] font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── Right TOC (Prava-style grouped) ──────────────────────────────────────────

function DocToc({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <div>
      {/* "On this page" header */}
      <div className="mb-4 flex items-center gap-2">
        <AlignLeft className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
          On this page
        </span>
      </div>

      {/* Grouped TOC */}
      <nav className="border-l border-border/60 pl-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {/* Group label */}
            <div className="mb-1 text-[10.5px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
              {section.label}
            </div>
            {/* Items */}
            <div className="space-y-px">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full text-left py-0.5 text-[12.5px] transition-colors duration-200 block",
                    activeId === item.id
                      ? "font-semibold text-[#00c951]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

// ─── Main docs page ───────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeId, setActiveId] = useState("overview");

  useEffect(() => {
    const headings = document.querySelectorAll("[data-doc-heading]");
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-10% 0% -82% 0%" }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex gap-10 relative">
      {/* ── Left nav ── */}
      <aside className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-5.5rem)] pb-8">
          <DocLeftNav activeId={activeId} onNavigate={scrollTo} />
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="min-w-0 flex-1 pb-32">

        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <div className="mb-10 pb-10 border-b border-border">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-seal/30 bg-seal/5 px-3 py-1 text-[11px] font-semibold text-seal">
            CLI Reference
          </div>
          <h1 className="font-heading text-[34px] font-bold tracking-tight text-foreground leading-tight">
            gate CLI
          </h1>
          <P className="max-w-2xl mt-3">
            The command-line policy engine and execution gateway for Vitta. Gates AI browser-automation
            commands behind human-issued, <strong className="text-foreground font-semibold">Ed25519-signed spending mandates</strong>,
            settles via Prava Payments, and records cryptographically verifiable receipts in a hash chain.
          </P>

          {/* Command quick-ref */}
          <div className="mt-6 rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Commands
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {[
                { cmd: "gate scan", desc: "Inspect webcmd coverage", id: "gate-scan" },
                { cmd: "gate mandate create", desc: "Issue a signed mandate", id: "gate-mandate-create" },
                { cmd: "gate mandate resign", desc: "Re-sign with new caps", id: "gate-mandate-resign" },
                { cmd: "gate fund", desc: "Attach a Prava reserve", id: "gate-fund" },
                { cmd: "gate run", desc: "Execute with policy enforcement", id: "gate-run" },
                { cmd: "gate verify", desc: "Verify cryptographic chain", id: "gate-verify" },
              ].map((item, i, arr) => (
                <button
                  key={item.cmd}
                  onClick={() => scrollTo(item.id)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-left group",
                    "hover:bg-muted/40 transition-colors duration-150",
                    i % 2 === 0 ? "sm:border-r border-border" : "",
                    i < arr.length - 2 ? "border-b border-border" : "",
                    i === arr.length - 2 && arr.length % 2 === 0 ? "border-b border-border sm:border-b-0" : "",
                  )}
                >
                  <code className="font-mono text-[12px] text-foreground group-hover:text-[#00c951] transition-colors duration-150">
                    {item.cmd}
                  </code>
                  <span className="text-[11px] text-ink-faint">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Introduction ══════════════════════════════════════════════ */}
        <DocH2 id="overview">Introduction</DocH2>
        <P>
          <strong className="text-foreground font-semibold">Vitta</strong> is an AI spending policy engine.
          It intercepts every browser-automation command that involves real money and enforces a
          human-issued, cryptographically signed authorization —{" "}
          <strong className="text-foreground font-semibold">a mandate</strong> — before any
          transaction executes.
        </P>
        <P>
          The <IC>gate</IC> CLI wraps <IC>webcmd</IC> (a self-learning browser automation tool with
          805 compiled site commands) and applies policy on every invocation: reads pass freely,
          writes are gated.
        </P>

        {/* 3 pillars */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "🔐", title: "Sign first", desc: "Every spend requires a human-issued Ed25519-signed mandate. No mandate → no execution." },
            { icon: "⚡", title: "Decide instantly", desc: "Pure TypeScript policy engine — no LLM, no network, sub-millisecond and deterministic." },
            { icon: "🔗", title: "Prove later", desc: "Every transaction writes a hash-linked, signed receipt. Edit any entry and the chain breaks visibly." },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card px-5 py-5">
              <div className="text-2xl mb-3">{card.icon}</div>
              <div className="text-sm font-semibold text-foreground mb-1.5">{card.title}</div>
              <div className="text-[13px] text-muted-foreground leading-relaxed">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* ══ Quick Start ═══════════════════════════════════════════════ */}
        <DocH2 id="quick-start">Quick start</DocH2>
        <P>From zero to a gated browser-agent order in five steps.</P>

        <DocH3 id="qs-1">1 — Install webcmd</DocH3>
        <CodeBlock code={`npm install -g @agentrhq/webcmd`} />

        <DocH3 id="qs-2">2 — Generate Ed25519 keys</DocH3>
        <P>Keys are generated automatically on first <IC>gate</IC> run. To generate manually:</P>
        <CodeBlock code={`openssl genpkey -algorithm ed25519 -out keys/gate.private.pem\nopenssl pkey -in keys/gate.private.pem -pubout -out keys/gate.public.pem`} />
        <Callout type="info">
          Keys live in <IC>keys/</IC> and never leave the machine. The public key is embedded in every
          mandate and receipt for offline verification.
        </Callout>

        <DocH3 id="qs-3">3 — Create a mandate</DocH3>
        <CodeBlock code={`gate mandate create \\\n  --subject "agent:grocery-runner" \\\n  --cap 1000 \\\n  --per-txn 800 \\\n  --merchants "blinkit" \\\n  --expires "6h"`} />

        <DocH3 id="qs-4">4 — Run the agent</DocH3>
        <CodeBlock title="read — free, no policy check" code={`gate run -- webcmd blinkit search "fortified wheat atta 5kg"`} />
        <CodeBlock title="write — gated execution" code={`gate run -- webcmd blinkit add-to-cart --product-id 333764\ngate run -- webcmd blinkit place-order --confirm`} />

        <DocH3 id="qs-5">5 — Verify the receipt chain</DocH3>
        <CodeBlock code={`gate verify <receipt_id>`} />

        {/* ══ Architecture ══════════════════════════════════════════════ */}
        <DocH2 id="architecture">Architecture</DocH2>
        <P>The system has six independently testable layers, each with a single responsibility.</P>

        <div className="mt-5 rounded-xl border border-border overflow-hidden">
          {[
            { layer: "CLI", path: "src/cli/gate.ts", desc: "Command parsing, orchestration, terminal output. The only file that touches stdio." },
            { layer: "Policy", path: "src/policy/decide.ts", desc: "Pure function: mandate × spend request → ALLOW | DENY | STEP_UP. Zero I/O, 65 unit tests." },
            { layer: "Mandate", path: "src/mandate/", desc: "Ed25519 key management, mandate schema validation, signing, and DID derivation." },
            { layer: "Receipt", path: "src/receipt/", desc: "SHA-256 hash chain construction, receipt signing, and chain verification." },
            { layer: "Ledger", path: "src/ledger/", desc: "Prava Payments credit entitlement — balance queries, deduction, and reserve management." },
            { layer: "webcmd", path: "src/webcmd/", desc: "Manifest loading, cart-total resolution, and process spawning (childProcess.spawn, not shell)." },
          ].map((row, i, arr) => (
            <div key={row.layer} className={cn("flex items-start gap-5 px-5 py-4", i < arr.length - 1 && "border-b border-border")}>
              <div className="w-16 shrink-0 text-[11px] font-bold tracking-widest text-seal uppercase pt-0.5">{row.layer}</div>
              <div className="flex-1 min-w-0">
                <code className="font-mono text-[12px] text-foreground">{row.path}</code>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{row.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══ gate scan ═════════════════════════════════════════════════ */}
        <DocH2 id="gate-scan">gate scan</DocH2>
        <P>
          Reads the <IC>webcmd</IC> manifest and reports total available commands, how many are write access,
          and how many are governed by an active mandate.
        </P>
        <DocH3 id="gate-scan-usage">Usage</DocH3>
        <CodeBlock code={`gate scan`} />
        <DocH3 id="gate-scan-output">Output</DocH3>
        <CodeBlock title="output" code={`✓ webcmd manifest loaded — 1 sites, 15 commands\n  7 marked access:'write'\n  7 currently governed`} />
        <P>
          Use <IC>gate scan</IC> before creating a mandate to understand write-command coverage.
          Any write command not covered by an active mandate will be blocked at the gate.
        </P>

        {/* ══ gate mandate create ═══════════════════════════════════════ */}
        <DocH2 id="gate-mandate-create">gate mandate create</DocH2>
        <P>
          Issues a new human-signed spending authorization. The mandate is serialized in canonical JSON,
          signed with the gate&apos;s Ed25519 private key, and saved to <IC>mandates/</IC>.
        </P>
        <DocH3 id="gate-mandate-create-usage">Usage</DocH3>
        <CodeBlock code={`gate mandate create \\\n  --subject <did>        \\\n  --cap <inr>            \\\n  --per-txn <inr>        \\\n  --merchants <m1,m2>    \\\n  --expires <duration>   \\\n  [--categories <c1,c2>] \\\n  [--max-txns <n>]`} />
        <DocH3 id="gate-mandate-create-flags">Flags</DocH3>
        <FlagTable flags={[
          { flag: "--subject", required: true, description: "Subject / agent DID. Use did:key:z6M… format or a shorthand like agent:grocery-runner." },
          { flag: "--cap", required: true, description: "Total spending cap in INR (₹). The mandate's lifetime cumulative ceiling." },
          { flag: "--per-txn", required: true, description: "Maximum amount per single transaction in INR. Enforced by Rule 6 in decide()." },
          { flag: "--merchants", required: true, description: "Comma-separated list of allowed merchant sites (e.g. blinkit,zepto)." },
          { flag: "--expires", required: true, description: "Duration string (1h, 30m, 2h30m) or ISO timestamp. Mandate is strictly invalid after this." },
          { flag: "--categories", required: false, description: "Allowed purchase categories. Defaults to groceries." },
          { flag: "--max-txns", required: false, description: "Maximum number of transactions under this mandate. Defaults to 1." },
        ]} />
        <DocH3 id="gate-mandate-create-example">Example</DocH3>
        <CodeBlock code={`gate mandate create \\\n  --subject "did:key:z6MktiLJ3CLa8rezn5W57rLJ3C" \\\n  --cap 800 \\\n  --per-txn 800 \\\n  --merchants "blinkit,zepto" \\\n  --expires "6h" \\\n  --max-txns 1`} />
        <CodeBlock title="output" code={`✓ mandate created  mnd_ms5wgmdw41918f187092\n  subject   did:key:z6MktiLJ3CLa8rezn5W57…\n  cap       ₹800  per-txn ₹800  max-txns 1\n  expires   6 hours from now\n  sig       4w/Lk00q8cDs2xgaGRJonafe…  (Ed25519)`} />

        {/* ══ gate mandate resign ═══════════════════════════════════════ */}
        <DocH2 id="gate-mandate-resign">gate mandate resign</DocH2>
        <P>
          Re-issues and re-signs an existing mandate with updated spending limits. The primary use case is a{" "}
          <strong className="text-foreground font-semibold">step-up approval</strong>: when{" "}
          <IC>gate run</IC> returns <IC>STEP_UP</IC>, a human reviews and re-signs at the higher cap.
        </P>
        <DocH3 id="gate-mandate-resign-usage">Usage</DocH3>
        <CodeBlock code={`gate mandate resign <mandate_id> --cap <new_cap> [--per-txn <new_per_txn>]`} />
        <DocH3 id="gate-mandate-resign-example">Example</DocH3>
        <CodeBlock code={`gate mandate resign mnd_ms5wgmdw41918f187092 --cap 1500 --per-txn 1500`} />
        <Callout type="tip">
          Re-signing invalidates the original signature and produces a new one. The mandate ID is preserved,
          but all previously signed copies become invalid — enforced by Rule 1 of the policy engine.
        </Callout>

        {/* ══ gate fund ═════════════════════════════════════════════════ */}
        <DocH2 id="gate-fund">gate fund</DocH2>
        <P>
          Attaches a funded Prava Payments credit reserve to a mandate. In test mode, this creates a
          credit entitlement checked by the policy engine before allowing any write transaction.
        </P>
        <DocH3 id="gate-fund-usage">Usage</DocH3>
        <CodeBlock code={`# Fund a new reserve\ngate fund <mandate_id> --amount <inr>\n\n# Attach an existing reserve reference\ngate fund <mandate_id> --reserve-ref <prava_session_ref>`} />
        <FlagTable flags={[
          { flag: "--amount", description: "Amount in INR (₹) to fund. Creates a new Prava credit entitlement." },
          { flag: "--reserve-ref", description: "Attach an existing Prava reserve reference instead of creating a new one." },
        ]} />
        <Callout type="info">
          Configure <IC>PRAVA_API_KEY</IC> and <IC>PRAVA_CREDIT_ENTITLEMENT_ID</IC> in <IC>.env</IC> to enable
          live reserve balance queries. Without these, the reserve shows as unavailable in the dashboard.
        </Callout>

        {/* ══ gate run ══════════════════════════════════════════════════ */}
        <DocH2 id="gate-run">gate run</DocH2>
        <P>
          The core execution engine. <IC>gate run</IC> wraps any <IC>webcmd</IC> command through
          the full policy pipeline — from permission check to signed receipt.
        </P>
        <Callout type="warning">
          This is the <strong className="font-semibold">only command that triggers real spending</strong>.
          All other <IC>gate</IC> subcommands are read-only or administrative.
        </Callout>
        <DocH3 id="gate-run-usage">Usage</DocH3>
        <CodeBlock code={`gate run -- webcmd <site> <command> [args...] [--run-id <id>]`} />
        <DocH3 id="gate-run-pipeline">Execution pipeline</DocH3>
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          {[
            { step: "01", label: "Permission check", desc: "Reads the webcmd manifest. Read commands short-circuit immediately — no mandate check, no ledger touch." },
            { step: "02", label: "Cart resolution", desc: "Calls webcmd blinkit cart -f json and checkout -f json to get the live cart total from the real site." },
            { step: "03", label: "Policy decision", desc: "decide() evaluates 9 ordered rules against the mandate. Pure TypeScript, zero LLM calls, deterministic." },
            { step: "04", label: "Process execution", desc: "If ALLOW, spawns the webcmd binary via Node.js childProcess.spawn — not shell, so no injection risk." },
            { step: "05", label: "Ledger deduction", desc: "Calls Prava Payments API to deduct the settled amount from the mandate's credit reserve." },
            { step: "06", label: "Signed receipt", desc: "Writes a hash-linked, Ed25519-signed receipt to receipts/ and appends an event line to events.jsonl." },
          ].map((s, i, arr) => (
            <div key={s.step} className={cn("flex gap-4 px-5 py-4", i < arr.length - 1 && "border-b border-border")}>
              <div className="w-8 shrink-0 font-mono text-[11px] tracking-widest text-seal/80 pt-0.5">{s.step}</div>
              <div>
                <div className="text-sm font-semibold text-foreground">{s.label}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <DocH3 id="gate-run-examples">Examples</DocH3>
        <CodeBlock title="read — no policy check" code={`gate run -- webcmd blinkit search "fortified wheat atta 5kg"`} />
        <CodeBlock title="write — gated checkout" code={`gate run -- webcmd blinkit add-to-cart --product-id 333764\ngate run -- webcmd blinkit place-order --confirm`} />
        <DocH3 id="gate-run-verdicts">Decision outcomes</DocH3>
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          {[
            { verdict: "ALLOW", colorClass: "bg-allow/10 text-allow border-allow/30", desc: "All 9 policy rules pass. Command executes, funds deduct, receipt writes." },
            { verdict: "DENY", colorClass: "bg-deny/10 text-deny border-deny/30", desc: "At least one rule failed. Command is blocked — no funds move, no receipt, no side effects." },
            { verdict: "STEP_UP", colorClass: "bg-step-up/10 text-step-up border-step-up/30", desc: "Mandate valid but spending cap insufficient. Run gate mandate resign at a higher cap and retry." },
          ].map((v, i, arr) => (
            <div key={v.verdict} className={cn("flex items-start gap-3 px-5 py-4", i < arr.length - 1 && "border-b border-border")}>
              <span className={cn("mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase", v.colorClass)}>
                {v.verdict}
              </span>
              <span className="text-[14px] text-muted-foreground leading-relaxed">{v.desc}</span>
            </div>
          ))}
        </div>

        {/* ══ gate receipt show ═════════════════════════════════════════ */}
        <DocH2 id="gate-receipt-show">gate receipt show</DocH2>
        <P>
          Displays a structured breakdown and cryptographic trace for a specific settled receipt.
          Useful for auditing a specific order without opening the dashboard.
        </P>
        <DocH3 id="gate-receipt-show-usage">Usage</DocH3>
        <CodeBlock code={`gate receipt show <receipt_id>`} />
        <DocH3 id="gate-receipt-show-output">Output</DocH3>
        <CodeBlock title="output" code={`✓ RECEIPT rcp_01JKEY5678 signed\n\n  mandate   mnd_01JKEY1234\n  cart      blinkit · 2 items · ₹476\n  payment   prava_sandbox · captured\n  run       blinkit/place-order · run_9876\n  evidence  trace sha256:a1b2c3…  order #ORD12345\n  prev      0000…0000  (chain head)`} />

        {/* ══ gate verify ═══════════════════════════════════════════════ */}
        <DocH2 id="gate-verify">gate verify</DocH2>
        <P>
          Cryptographically verifies a receipt&apos;s Ed25519 signature and confirms the SHA-256 hash
          chain link to its predecessor is intact. Two failure modes are reported distinctly.
        </P>
        <DocH3 id="gate-verify-usage">Usage</DocH3>
        <CodeBlock code={`gate verify <receipt_id>`} />
        <DocH3 id="gate-verify-output">Output</DocH3>
        <CodeBlock title="chain intact" code={`✓ signature valid · chain intact`} />
        <CodeBlock title="receipt tampered" code={`✗ signature invalid — receipt tampered`} />
        <CodeBlock title="chain broken" code={`✗ chain link invalid — predecessor was modified`} />
        <Callout type="tip">
          To demo tamper detection: edit any field in a <IC>receipts/*.json</IC> file, then run{" "}
          <IC>gate verify {"<"}receipt_id{">"}</IC>. The signature check fails on the edited receipt;
          the chain link check fails on the <em>next</em> receipt — proving the hash chain property.
        </Callout>

        {/* ══ Policy Engine ═════════════════════════════════════════════ */}
        <DocH2 id="policy-engine">Policy engine</DocH2>
        <P>
          <IC>decide()</IC> in <IC>src/policy/decide.ts</IC> is a pure, synchronous TypeScript
          function — no LLM, no network call, no randomness. It evaluates 9 ordered rules and returns
          a typed <IC>Decision</IC> object. Rule order is load-bearing.
        </P>
        <DocH3 id="policy-engine-signature">Function signature</DocH3>
        <CodeBlock language="typescript" code={`function decide(\n  req:           SpendRequest,   // { command, site, access, amountInr? }\n  mandate:       Mandate,\n  publicKey:     KeyObject,       // Ed25519 public key\n  ledgerBalance: number,          // remaining reserve in INR\n  txnCountSoFar: number,\n  now:           Date,\n): Decision;                       // ALLOW | DENY | STEP_UP`} />
        <DocH3 id="policy-engine-rules">Decision rules — in order</DocH3>
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          {[
            { rule: "Rule 0", code: "read access", verdict: "ALLOW", vColor: "text-allow bg-allow/10 border-allow/30", desc: "Read access short-circuits immediately — no mandate check, no ledger touch, no signature verification." },
            { rule: "Rule 1", code: "BAD_SIGNATURE", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Mandate's Ed25519 signature does not verify against the gate's public key." },
            { rule: "Rule 2", code: "EXPIRED", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Current time is at or past mandate's expires_at field." },
            { rule: "Rule 3", code: "UNKNOWN_COMMAND", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Command not found in the webcmd manifest. Fails closed — unknown = denied." },
            { rule: "Rule 4", code: "MERCHANT_NOT_ALLOWED", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Target merchant site is not in mandate's scope.merchants list." },
            { rule: "Rule 5", code: "AMOUNT_UNPARSEABLE", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Cart total could not be resolved to a numeric INR amount from webcmd output." },
            { rule: "Rule 6", code: "OVER_PER_TXN_CAP", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Cart total exceeds mandate's per_txn_inr single-transaction limit." },
            { rule: "Rule 7", code: "OVER_TOTAL_CAP", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Cart total would exceed remaining mandate cap (ledgerBalance < amountInr)." },
            { rule: "Rule 8", code: "TXN_LIMIT_REACHED", verdict: "DENY", vColor: "text-deny bg-deny/10 border-deny/30", desc: "Mandate's max_txns count has already been exhausted." },
            { rule: "Pass", code: "all rules passed", verdict: "ALLOW", vColor: "text-allow bg-allow/10 border-allow/30", desc: "All rules pass. Command is authorized to execute." },
          ].map((row, i, arr) => (
            <div key={row.rule} className={cn("grid grid-cols-[5rem_1fr_5.5rem] gap-4 items-start px-5 py-3.5", i < arr.length - 1 && "border-b border-border", i === arr.length - 1 && "bg-allow/[0.03]")}>
              <div className="text-[11px] font-mono text-muted-foreground/60 pt-0.5">{row.rule}</div>
              <div>
                <code className={cn("font-mono text-[12px]", row.verdict === "ALLOW" ? "text-allow" : "text-deny")}>
                  {row.code}
                </code>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground leading-relaxed">{row.desc}</div>
              </div>
              <div className="text-right">
                <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase", row.vColor)}>
                  {row.verdict}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ══ Ed25519 Signing ════════════════════════════════════════════ */}
        <DocH2 id="ed25519-signing">Ed25519 signing</DocH2>
        <P>
          Every mandate and receipt in Vitta is signed with Ed25519 — a modern elliptic-curve signature scheme
          with 128-bit security, 64-byte signatures, and fast constant-time verification.
        </P>
        <P>
          When <IC>gate mandate create</IC> runs, the mandate is JSON-serialized in canonical form (keys sorted)
          and signed. The signature is stored in the <IC>sig</IC> field. Rule 1 re-verifies this on every{" "}
          <IC>gate run</IC>.
        </P>
        <CodeBlock language="json" title="receipt schema" code={`{\n  "receipt_id":        "rcp_01JKEY5678",\n  "mandate_hash":      "sha256:…",\n  "signed_at":         "2024-01-01T12:00:00.000Z",\n  "cart": {\n    "merchant":  "blinkit",\n    "items":     2,\n    "total_inr": 476\n  },\n  "payment": {\n    "rail":        "prava_sandbox",\n    "reserve_ref": "ent_…",\n    "status":      "captured"\n  },\n  "prev_receipt_hash": "sha256:…",   // ← hash chain link\n  "sig":               "4w/Lk00q…"  // ← Ed25519, 64 bytes\n}`} />

        {/* ══ Receipt chain ═════════════════════════════════════════════ */}
        <DocH2 id="receipt-chain">Receipt chain</DocH2>
        <P>
          Every receipt contains <IC>prev_receipt_hash</IC> — the SHA-256 hex digest of the raw JSON of the
          previous receipt. This forms a singly-linked hash chain. The first receipt uses{" "}
          <IC>CHAIN_HEAD_HASH</IC> (64 zeros) as its predecessor.
        </P>
        <DocH3 id="receipt-chain-tamper">Tamper detection</DocH3>
        <P>Modifying <strong className="text-foreground font-semibold">Receipt A</strong> produces two detectable failures:</P>
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          {[
            { num: "1", label: "Direct tamper", desc: "Receipt A's own sig field no longer matches its content. gate verify fails on A with ✗ signature invalid." },
            { num: "2", label: "Chain break", desc: "Receipt B's prev_receipt_hash no longer matches the hash of modified A. gate verify fails on B with ✗ chain link invalid." },
          ].map((row, i, arr) => (
            <div key={row.num} className={cn("flex gap-5 px-5 py-4", i < arr.length - 1 && "border-b border-border")}>
              <div className="size-6 shrink-0 rounded-full bg-deny/10 border border-deny/20 flex items-center justify-center text-[11px] font-bold text-deny">{row.num}</div>
              <div>
                <div className="text-sm font-semibold text-foreground">{row.label}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <P>
          The Vitta dashboard&apos;s <strong className="text-foreground font-semibold">Proof chain</strong> page
          visualizes this — each receipt shows its verification status with a green (valid) or red (broken)
          left-border indicator, visible without running any CLI command.
        </P>

        {/* Footer */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-6">
          <p className="text-[12px] text-ink-faint">Vitta · MIT-licensed · Built for AI spending governance</p>
          <p className="font-mono text-[11px] text-ink-faint">src/policy/decide.ts · 65 tests passing</p>
        </div>
      </main>

      {/* ── Right TOC ── */}
      <aside className="hidden xl:block w-48 shrink-0">
        <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-5.5rem)] pb-8">
          <DocToc activeId={activeId} onNavigate={scrollTo} />
        </div>
      </aside>
    </div>
  );
}
