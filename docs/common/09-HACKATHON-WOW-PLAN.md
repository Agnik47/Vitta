# 09 — Hackathon Demo & "Wow Factor" Plan

Not part of the Tier 1/Tier 2 reading split in `00-START-HERE.md` — this is a time-boxed execution plan for the final stretch (2026-07-29 → 2026-08-01), written after a full pass over `08-CHANGELOG.md`, both agents' `WORKSPACE.md` files, `04-BLOCKERS.md`, `docs/05-DEMO-SCRIPT.md`, `docs/06-DASHBOARD-SPEC.md`, root `FEATURES.md`, `OVERVIEW.md`, and `PRODUCT_FEATURE.md`. Read it once, then work the checklists — it doesn't replace `01-PROJECT-STATUS.md` as the live status tracker, it sits on top of it with a deadline-shaped lens.

**User decision, 2026-07-29: authorized a small real place-order (Beats 5-8) to close the acceptance checklist for real.** This is the plan's single biggest assumption — see Phase 1.

---

## 1. Where things actually stand (the understanding pass)

**Both external blockers (B-001 Dodo account, B-002 webcmd connectivity) are resolved.** Every Phase 1 module is real, not stubbed: signed mandates (Ed25519, canonical JSON, did:key issuer), `decide()` (pure/deterministic/zero-LLM, 11 tests), real Dodo test-mode ledger (`fund`/`balance`/`draw`/`release`, idempotency confirmed against the live API), real webcmd manifest + executor (805 commands, real browser execution, real `runId`/`traceDigest`), signed hash-chained receipts, the `gate` CLI (all 7 subcommands), and a Next.js dashboard (3 pages, all GET-only, all wired to real files + real Dodo balance).

**Live rehearsal status (`docs/05-DEMO-SCRIPT.md`):**V
- Beats 1-4 — **real, confirmed**: `gate scan`, real mandate creation, real Dodo checkout + real test-card payment, real Blinkit login/search/add-to-cart (correctly ₹0, untouched by ledger), real cart read, real `DENY (OVER_PER_TXN_CAP)` against a real over-cap cart, zero webcmd call on the deny path.
- Beats 5-8 — **not yet run anywhere.** Real `place-order`, the resulting signed receipt, `gate verify`, and the idempotency-retry check. Purely blocked on a human authorizing a real merchant purchase (not Dodo test money — this part is genuinely real-world money) — never a code gap. **Now authorized, see Phase 1.**

**What Agent B pushed most recently (the tail of `08-CHANGELOG.md`):** resolved B-002 (missing ~535MB Chromium binary + a Windows `PATH`/`ENOENT` chain), found+fixed 3 real bugs in `execute()` (unsafe process spawning, `runId` never populated), found+fixed the `events.jsonl`-never-written bug (dashboard's `/events` was dead during a real run — ADR-008), and resolved `tracePath`/`trace_digest` being structurally always-empty (wrong trace mode — ADR-009). All committed, all re-verified with `tsc --noEmit` clean + 45/45 tests. Nothing here is undone work — it's all closed.

**`FEATURES.md`** is an accurate, current snapshot of the real system above. **`PRODUCT_FEATURE.md`** is a *different, much larger* product idea — an "AI Autonomous Shopping Agent" with marketplace comparison, a shopping-rule builder, price/coupon monitoring, a browser side panel, notifications, savings tracking. **None of it exists in code.** It reads as a roadmap/pitch doc bolted on after the fact, not a spec that was ever executed against. Treat it as inspiration for visuals and narrative, not as a punch list of things to actually build for real — there is nowhere near enough time, and building any of it "for real" (live price scraping, autonomous monitoring loops, a real rule engine) would blow past `docs/07-SCALING-PATH.md`'s explicit "not Phase 1" boundary and CLAUDE.md's dependency/scope rules.

---

## 2. The strategy this plan follows

You already have more real, working, end-to-end proof than most hackathon teams ship. The risk isn't "nothing works" — it's "the judges can't *see* how good it is" because the dashboard is functionally correct but visually a bare Tailwind list (`dl`/`dt` pairs, plain badges, no motion, no hierarchy). So:

1. **Finish the one remaining real thing** (Beats 5-8) — it's already-written code, already-tested in isolation, just never run end-to-end. This is the highest ROI item on the entire list: a few hours of careful, low-stakes execution turns "we built a policy engine" into "watch it deny an over-budget cart, then approve a real purchase, produce a tamper-proof receipt, and refuse to double-charge — on a real site, with real (small) money."
2. **Make the dashboard look like a real fintech security product**, because visually that's the entire "wow" surface judges will actually look at during narration. No backend changes required for this — it's CSS/layout/motion work on top of data that's already real.
3. **Everything from `PRODUCT_FEATURE.md`** (comparison shopping, rule builder, savings, notifications) becomes a **clearly-labeled concept layer** — good-looking, static/sample-data screens that show the bigger vision, sitting next to (never mixed into) the real pages. Label discipline matters here: this project's entire pitch is "we don't fake the money-moving parts" — a concept screen that isn't honestly labeled as a preview undercuts that pitch the moment a judge asks "is this live?". Fake it visually, never fake it silently.

---

## Phase 0 — Decisions (today, ~30 min, no code)

- [x] Authorize Beats 5-8 real purchase — **done, 2026-07-29.**
- [ ] Pick the exact SKU/merchant for the real order — cheapest plausible real item on Blinkit (the already-tested merchant), ideally something already in a cart from the Beats 1-4 rehearsal so the amount is known ahead of time.
- [ ] Pick which physical machine runs the *live* demo on 1 Aug (needs: `webcmd doctor` fully green, `cloakbrowser info` → `Installed: true`, dashboard `npm run build` tested there at least once — per `06-DASHBOARD-SPEC.md`'s own acceptance item, "tested on the actual demo machine, not for the first time on stage").
- [ ] Lock which 2-3 `PRODUCT_FEATURE.md` concepts get real design effort (recommendation below, Phase 3) rather than trying to storyboard all ten sections.

## Phase 1 — Close the real acceptance checklist (Beats 5-8) — **highest priority, do this first**

No new code is expected to be needed here — `cmdRun`/`cmdFund`/`execute()`/`DodoCreditLedger`/receipt chain are all already real and already type-check. This phase is *execution*, not development.

- [ ] Re-run `webcmd doctor` and `cloakbrowser info` on whichever machine will do this — confirm still green (browser binaries/sessions can go stale between sessions).
- [ ] `gate mandate resign` to step up the cap enough to cover the real cart (Beat 5).
- [ ] Run `gate run -- webcmd blinkit place-order --confirm` for real — capture the full terminal output.
- [ ] `gate receipt show <id>` — confirm every field is real (mandate hash, cart total, run_id, order id, `trace_digest`).
- [ ] `gate verify <id>` — confirm signature + chain valid.
- [ ] Beat 7 tamper test: edit the receipt file on disk, re-run `gate verify`, confirm it now fails, confirm the *dashboard's* `/receipts` page (if up) flips within one poll cycle too.
- [ ] Beat 8 idempotency test: re-submit the same `run_id`, confirm `DENY ALREADY_EXECUTED`, confirm no second draw happened (`ledger.jsonl` + Dodo balance both checked).
- [ ] Paste all real terminal output into `docs/OUTCOME.md` (Phase 1g section) — do not paraphrase, per that file's own rules.
- [ ] Update `docs/05-DEMO-SCRIPT.md`'s acceptance checklist boxes and `docs/common/01-PROJECT-STATUS.md`.
- [ ] **Record a video of this exact run, dated** — `docs/05-DEMO-SCRIPT.md`'s own acceptance checklist requires a fallback recording to exist on disk before 31 Jul night. This is not optional polish; it's the thing that saves the live demo if venue wifi or a live site both misbehave on 1 Aug.

## Phase 2 — Dashboard visual overhaul (the actual "wow" ask)

Zero backend/API changes. Same data (`/api/mandate`, `/api/events`, `/api/receipts`), new presentation. Use the `frontend-design` and `dataviz` skills when actually building this for a coherent visual system rather than ad hoc styling.

- [ ] Establish one visual language: dark, high-contrast, security/fintech-trust aesthetic (this is a product about cryptographic guarantees over money — the UI should *feel* like that, not like a generic CRUD admin panel). Pick a real type scale, a restrained accent-color set (e.g., one signal color per verdict, reused everywhere), consistent spacing.
- [ ] `/` (mandate): a hero card instead of a `dl` grid — big cap amount, a countdown ring/progress bar for time-to-expiry, a reserve-balance gauge (real Dodo balance, animated fill), merchants shown as chips/logos, the "TEST MODE" banner redesigned to look intentional rather than a leftover warning strip.
- [ ] `/events`: terminal-inspired live feed — monospace, color-pulsed row entry on arrival (green flash for ALLOW, red for DENY, amber for STEP_UP), auto-scroll, a running counter ("N ALLOW · N DENY today"). Still just polling `?since=`, per the spec — no new data-fetching pattern needed.
- [ ] `/receipts`: render the hash chain *as a chain* — linked blocks/nodes with a visible link line between them, the link breaking visually (color change + a "snap" transition) the instant a tamper test invalidates it. This is the single most demo-able visual in the whole app: judges watching a cryptographic tamper-proof chain visibly break in real time as you `sed -i` a JSON file on stage is a genuine wow moment, and the data behind it is 100% real.
- [ ] Add a small "pipeline" component (mandate signed → funded → decided → executed → receipted) that lights up stage-by-stage, driven by real `GateEvent`s / receipt presence — not a fake animation loop, an actual reflection of state.
- [ ] New dependency check: before adding any charting/animation library (Framer Motion, Recharts, etc.), remember CLAUDE.md rule 5 — no new dependency without a documented reason. Default to CSS transitions + hand-written SVG (gauges, chain links, countdown rings are all simple enough by hand); if a library is genuinely worth it for time saved, write a one-paragraph ADR in `02-DECISIONS.md` before adding it, same as every other real decision this build has logged.
- [ ] Re-run the existing acceptance items after the redesign: `/events` still updates within ~2s of a real event, `/receipts` still flips to invalid on a real tamper edit, dashboard still survives being killed mid-`gate run` (re-verify — a visual rewrite is exactly the kind of change that can quietly reintroduce a regression here).

## Phase 3 — The "fake it visually" concept layer (`PRODUCT_FEATURE.md`'s vision)

Purely additive, clearly labeled, static/sample data only, never wired to a write path, never mixed into the real Mandate/Events/Receipts pages. Recommendation — pick 2-3, not all 10 `PRODUCT_FEATURE.md` sections, given the time left:

- [ ] **Marketplace comparison view** — Blinkit/Zepto/BigBasket/Instamart side by side (listed price, final checkout cost with fees/discounts, ETA) for a sample product. Highest visual payoff, directly matches the demo script the vision doc itself proposes ("Search → Compare → ...").
- [ ] **Shopping Rule Builder concept** — a polished form (product, target price, budget, merchants, expiry) that visibly *becomes* a Mandate on submit (tie it back to the real thing: "this is what creates the mandate you just saw signed" — a nice narrative bridge from vision to reality) — but the actual submit action stays a local-state mock, never a real write, per the dashboard's hard read-only rule.
- [ ] **Activity timeline / savings overview** — a sample chart (use the `dataviz` skill's palette/heuristics for anything chart-shaped) showing search → compare → checkout → mandate approval → payment → receipt as one visual timeline, reusing real receipt/event data where it exists and clearly-labeled sample data where it doesn't.
- [ ] Every concept screen gets a visible, unmissable label (e.g., a persistent "Concept Preview — not live" tag, consistent placement, same visual weight as the existing "TEST MODE" banner) — this is a design requirement, not a footnote, because the project's whole credibility rests on judges being able to tell real from illustrative at a glance.
- [ ] Do not let concept-layer work start before Phase 1 (Beats 5-8) is done — the real acceptance checklist is the thing actually gating "Phase 1 complete," and it's further along than the visual work.

## Phase 4 — Rehearsal, timing, fallback

- [ ] Full run, timed, start to finish, under 4 minutes (`docs/05-DEMO-SCRIPT.md`'s own acceptance bar) — narrating live over the terminal + dashboard side by side.
- [ ] Kill the dashboard mid-`gate run` one more time after all visual changes land — confirm the CLI path is completely unaffected (this exact regression class already bit the project once, see ADR-008).
- [ ] Confirm the demo machine (Phase 0) runs `dashboard`'s production build (`npm run build && npm run start`, never `next dev`) and `gate` cleanly, together, at the same time.
- [ ] Re-record the fallback video if the Phase 1 run or the visual layer changed anything since the first recording.

## Phase 5 — Demo polish (1 Aug morning, light touch only)

- [ ] Narration script mapped to `docs/05-DEMO-SCRIPT.md`'s beats, but delivered through the new dashboard visuals, not raw terminal alone.
- [ ] One line ready for the inevitable question: "which of this is real?" — real = mandate, decide(), Dodo ledger, webcmd, receipts, CLI, the 3 core dashboard pages; concept = anything under the labeled preview section from Phase 3.
- [ ] No new code this day. If something breaks, fall back to the recorded video (Phase 1/4), don't debug live.

---

## Explicit non-goals (don't build these, even if there's spare time)

- Anything from `docs/07-SCALING-PATH.md` (database, auth, message queue, multi-tenant) — out of scope by CLAUDE.md's own rule.
- A real, working price-monitoring loop, real marketplace scraping/comparison, or a real autonomous "AI monitors prices" agent — this is the part of `PRODUCT_FEATURE.md` most likely to tempt scope creep, and it's genuinely a different (larger) project. Concept-layer only.
- Any write path added to `dashboard/` — hard rule, no exceptions, unaffected by anything in this plan.
- Any LLM call inside `decide()` — unaffected, unrelated to this plan, just restating the standing rule since visual work sometimes tempts "let's make the policy engine explain itself via a model" — don't.
