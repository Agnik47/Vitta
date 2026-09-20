# Vitta Agent Ops — Architecture (edit context)

## 1. Product intent

See README sections 2 to 7 for the problem, goals and requirements.

### 1.2 User stories

| # | Story (summary) | Requirement |
|---|---|---|
| 1 | See every run and its outcome | FR-1 |
| 2 | Search, filter, sort | FR-2, FR-3, FR-4 |
| 3 | Open a run, see each step | FR-5, FR-6 |
| 4 | See which agents are live | FR-7 |
| 5 | Understand refusal reasons | FR-8 |

## 2. UI & interaction

### 2.1 Visual tokens

Domain: a control room for a spending gate. Cool slate canvas, white panels, one indigo accent (the "gate"), and four status tones. Numbers use tabular figures so durations align. No custom fonts (system stack).

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F2F4F8` | Page background |
| `panel` | `#FFFFFF` | Cards, table, header, drawer |
| `ink` | `#111C2B` | Primary text |
| `mute` | `#5A6A7E` | Secondary text |
| `rule` | `#DCE2EA` | Borders, timeline line, "not reached" dot |
| `gate` / `gateSoft` | `#2F3FBF` / `#E8EBFB` | Accent, active tab, rule codes, focus rings |
| `ok` / `okSoft` | `#0B7D66` / `#DDF3EC` | Done, running in Nasiko |
| `bad` / `badSoft` | `#B42E44` / `#FBE4E8` | Failed |
| `hold` / `holdSoft` | `#8A5B0C` / `#FBF0D9` | Needs approval, beside the gate |
| `idleSoft` | `#E9EDF2` | Neutral badges (nothing to buy, skipped) |

Tokens are declared in `tailwind.config` inside `index.html`. Tone classes are written out in full in `TONE_BADGE` / `TONE_DOT` so the Tailwind CDN can see them.

### 2.2 Interaction contract

- Shell: `#root > div.h-[100dvh].overflow-hidden.flex.flex-col`; the header is `sticky` and outside `main`, which is the only scroll container.
- Tabs are buttons with `role="tab"` and `aria-selected`; the active tab is underlined in `gate`.
- Runs: search input is debounced 300 ms (`useDebounced`); changing search, outcome or sort resets to page 1; five rows per page.
- Row click or the request link opens the drawer; Escape, the backdrop or the close button closes it; focus moves to the close button on open.
- Failed run: banner names the first failed stage, shows a plain sentence from `ERROR_PLAIN`, and reveals the raw message on request.
- Trace id copy uses `navigator.clipboard`; if the host blocks it the label becomes "Select and copy" (the id is selectable text).

## 3. Data model & integrations

Independent mode: no connectors, no SDK, no network calls at runtime.

```
RUNS (6)        run_id, started_at, completed_at, status, mode, request_text, trace_id,
                routed, direct[], stages[{agent,status,summary,ms}], error{code,message}|null,
                intent{product_query,quantity,max_price_inr,purchase_required}|null,
                proposal{action,considered,reason}|null
AGENTS (4)      key, label, role, does, never, home ('nasiko'|'gate'), version|null
RULES (8)       order, code, meaning
STATUS          run outcome -> {label, tone}
STAGE_STATUS    step status -> {label, tone}
ERROR_PLAIN     error code  -> plain sentence
```

Data flow: `RUNS` -> `useMemo` filter (status, debounced text) -> sort -> slice by page -> table rows; the open run is looked up by id and passed to `RunDrawer`. Agent counters on the Agents screen are derived from `RUNS`.

Provenance of the data (2026-09-20): runs from Vitta's run store; agent names and versions from the Nasiko registry (planner 0.1.1, discovery 0.1.3, evaluator 0.1.1; purchase runs beside the gate); rules from `src/policy/decide.ts` (rules 1 to 8 in evaluation order).

## 4. Implementation map

| Requirement | Where in `src/main.jsx` |
|---|---|
| FR-1, FR-4 | `RunsScreen` (table, pagination) |
| FR-2, FR-3 | `RunsScreen` (`useDebounced`, `filtered`), toolbar selects |
| FR-5, FR-6 | `RunDrawer`, `ERROR_PLAIN` |
| FR-7 | `AgentsScreen`, `AGENTS` |
| FR-8 | `RulesScreen`, `RULES` |
| FR-9 | `EmptyState`, `RunDrawer` key handling |
| Shell | `App`, `TABS` |

## 5. Changelog

- 2026-09-20 — v1: Runs, Agents and Spending rules screens with a snapshot of real run records.

## 6. Project-specific learnings

- The platform API rejects punctuation in the app name and description.
- Preview uses Babel standalone with globals (`React`, `ReactDOM`); there is no module resolution, so everything lives in one `main.jsx`.
- To verify without a browser: transpile with TypeScript (`jsx: React`) and `renderToStaticMarkup` each screen with the same React 18; check for `undefined`, `NaN` and forbidden UI words.
