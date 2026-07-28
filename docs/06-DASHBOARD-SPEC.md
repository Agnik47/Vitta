# 06 — Dashboard Spec (Next.js)

Read `00-PRODUCT-BRIEF.md` through `05-DEMO-SCRIPT.md` first. This is a real Phase 1 deliverable, not a stub — build it after the CLI's data formats are stable (after `01-ARCHITECTURE.md` Phase 1a/1e are done), so it isn't reading a moving-target schema.

## What this is, and what it is not

A **read-only** web dashboard that gives judges and the room a browser-viewable, live view of mandate state, gate decisions, and receipts — a visual complement to the two-pane terminal UI, not a replacement for it. The terminal UI remains the primary narration surface and the reliability fallback (see `05-DEMO-SCRIPT.md`); the dashboard is additional, not load-bearing.

**Hard rule: the dashboard never writes.** It never creates a mandate, never funds a reserve, never triggers a spend, never calls `webcmd`. All actions happen exclusively through the `gate` CLI. The dashboard only observes state that the CLI already wrote to disk (`mandates/*.json`, `receipts/*.json`, `events.jsonl`) or reads from Dodo (read-only key only). This is not a limitation to work around later — it is the design. Building two code paths capable of the same mutation (CLI and dashboard) is exactly the kind of scope creep this project's phase discipline exists to prevent.

## Why a second app instead of extending the CLI

The dashboard is a separate Next.js application (its own `package.json`), not folded into `src/`. Reasoning: Next.js has its own build/runtime requirements that don't belong mixed into a Node CLI's dependency tree, and keeping it separate means a dashboard bug can never break `gate run` during a live narration. The cost of this separation is that a small amount of read-only logic (chain verification, balance reads) is re-implemented in the dashboard rather than imported from `src/`. That duplication is deliberate: setting up an npm/pnpm workspace monorepo to share code cleanly is real, avoidable complexity for logic that's a few lines long. Do not set up a workspace for this — just re-implement the small read paths.

## Folder structure

```
dashboard/
├── app/
│   ├── page.tsx              # mandate summary + live reserve balance
│   ├── events/page.tsx       # live GateEvent feed
│   ├── receipts/page.tsx     # receipts list + verify status
│   ├── api/
│   │   ├── mandate/route.ts  # GET — reads current mandate.json, calls Dodo balance (read-only key)
│   │   ├── events/route.ts   # GET — reads events.jsonl, supports ?since=<event_id> for incremental polling
│   │   └── receipts/route.ts # GET — lists receipts, walks the hash chain, returns verify status per receipt
│   └── layout.tsx
├── components/                # StatusBadge, EventRow, ReceiptCard, ReserveBalanceCard
├── lib/
│   └── read.ts                # file-reading + chain-verification helpers, local to this app
├── package.json
├── next.config.js
└── tailwind.config.ts
```

Point this app at the same data directory the CLI writes to via an environment variable, so both processes agree on location regardless of working directory:

```
# dashboard/.env.local
MANDATE_GATE_DATA_DIR=../          # relative to the project root, adjust to actual layout
DODO_API_KEY_READONLY=sk_test_ro_xxxxx   # same read-only key from docs/02-DODO-INTEGRATION.md
```

## Pages and what each must show

### `/` — Mandate summary

- Current mandate: subject, merchants in scope, per-transaction cap, total cap, expiry countdown
- Live reserve balance, read via the same Dodo Credit Entitlement Balance call described in `02-DODO-INTEGRATION.md` (using the read-only key — never the write key — inside the API route, which runs server-side and never exposes the key to the browser)
- A visible "TEST MODE" label, matching the honesty requirement in `00-PRODUCT-BRIEF.md`

### `/events` — Live GateEvent feed

- A reverse-chronological list/table of every `GateEvent` (see `01-ARCHITECTURE.md` for the schema) written to `events.jsonl`
- Color-coded verdict: ALLOW (green), DENY (red), STEP_UP (yellow)
- Polls `GET /api/events?since=<last_event_id>` every 1.5–2 seconds and appends new rows — do not re-fetch and re-render the entire list every poll, only append what's new
- No WebSockets or Server-Sent Events for Phase 1 — polling is simpler and has fewer failure modes under a live-demo deadline. If there is real time left after the acceptance checklist below passes, SSE is an acceptable upgrade, not a requirement.

### `/receipts` — Receipts and verification

- List of all receipts in `receipts/`, most recent first
- Each receipt shows its chain-verify status (valid/invalid), computed by walking `prev_receipt_hash` links exactly as `gate verify` does (re-implemented locally per the note above, not imported)
- Must visibly flip to "invalid" if the tamper test (`05-DEMO-SCRIPT.md` Beat 7) is performed on the underlying file — this is a real demo beat, the dashboard's status must reflect a real file edit, not a cached value

## API routes — server-side only, never expose write keys to the browser

```ts
// dashboard/app/api/events/route.ts (illustrative)
export async function GET(req: Request) {
  const since = new URL(req.url).searchParams.get('since');
  const lines = readNewEventsSince(process.env.MANDATE_GATE_DATA_DIR + '/events.jsonl', since);
  return Response.json(lines);
}
```

`DODO_API_KEY_READONLY` is read inside a Route Handler (Next.js App Router route handlers execute on the server, never in client-side JS). Never pass a Dodo API key as a prop to a client component, never expose it in a `NEXT_PUBLIC_*` environment variable.

## Package choices

| Layer | Choice |
|---|---|
| Framework | Next.js, App Router, latest stable — record the exact version `create-next-app` installs in `docs/OUTCOME.md`, don't hardcode a guess here |
| Styling | Tailwind CSS |
| Component library | None required by default. `shadcn/ui` is acceptable as optional polish only if the acceptance checklist below is already fully met with time to spare |
| Data fetching | Native `fetch` + `useEffect`/`setInterval` polling. No React Query, SWR, Zustand, or Redux — the polling logic here is simple enough not to need one |
| Persistence | None — reads the same flat files the CLI already writes |

## Run instructions for the actual demo

```
cd dashboard
npm run build
npm run start     # production build — do NOT use `next dev` during the live demo
```

A production build is faster and more stable under demo conditions than dev mode. Confirm this works on the actual demo machine before Saturday, not for the first time on stage.

## Acceptance checklist — this phase is done only when every line is true

- [ ] `/` shows the real current mandate and the real live Dodo reserve balance — not mocked, not hardcoded
- [ ] `/events` updates within ~2 seconds of a real `GateEvent` being written by the CLI, without a manual page refresh
- [ ] `/receipts` shows real chain-verify status, and flips to invalid after a real tamper-test file edit
- [ ] Code review confirms no API route in `dashboard/app/api/` performs a write to Dodo or invokes `webcmd` in any way
- [ ] The dashboard runs via `npm run build && npm run start` on the actual demo machine, tested at least once before Saturday
- [ ] The dashboard's failure (crash, blank page, network drop) does not interrupt the terminal-UI demo path — confirm the two are independent by killing the dashboard process mid-rehearsal and continuing the CLI demo unaffected
