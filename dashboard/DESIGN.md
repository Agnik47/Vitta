# Mandate Gate Dashboard — Design System

Written before any Phase 2 code, per `docs/common/09-HACKATHON-WOW-PLAN.md` and the user's explicit request. Owner: **Agent A**, presentation-layer only (`app/**/page.tsx`, `components/**`, `app/globals.css`) — see ADR-010 in `docs/common/02-DECISIONS.md`. This file governs everything built for Plan Phase 2 (dashboard visual overhaul) and Plan Phase 3 (concept-preview layer). Produced using the `frontend-design` skill's process; shadcn/ui is used as the component layer per direct user instruction (no dedicated "shadcn skill" is registered in this environment, so this file encodes shadcn's own conventions directly instead).

No existing design system to extend — the current dashboard (`app/page.tsx`, `app/events/page.tsx`, `app/receipts/page.tsx`) is unstyled default Tailwind (`dl`/`dt` grids, plain badges, Geist fonts, no component library). This file replaces that with a considered system. It does **not** touch `lib/*` or `app/api/**` — same real data, new presentation only.

---

## Product Context

- **Category:** a read-only observability dashboard for a cryptographically-enforced spending-permission system — not a generic business SaaS panel, not a marketing site. It's the visual companion to a live terminal CLI, showing the same real mandate/decision/receipt data.
- **Audience:** hackathon judges and the person narrating live, glanced at from a few feet on a screen/projector, plus (secondarily) a real future user who is finance/security-adjacent. Must read clearly at a glance during a <4-minute narrated demo, not just hold up under close inspection.
- **Primary use cases:** (1) check the current mandate + live reserve balance at a glance; (2) watch policy decisions (ALLOW/DENY/STEP_UP) stream in in real time; (3) inspect a receipt's hash chain and *watch it visibly break* during the tamper-test demo beat.
- **Brand personality:** precise, notarial, quietly confident — a signed legal document or a paper ledger rendered as software, not a "fun SaaS app." Never playful, never alarming, never generic-tech.
- **Emotional response target:** "this is a serious, precise instrument that can be trusted with money" — calm authority, not excitement.

## Chosen Visual Style — "Ledger / Notarial"

Not a straight pick off the shelf. It's **Editorial** (typography-led, confident whitespace, a distinctive serif carrying real weight) crossed with **Developer Tool** (monospace for anything cryptographic, hairline dividers over shadows, low-chrome density) — rendered in a **light/paper palette** per direct instruction, deliberately rejecting both templates' usual defaults (Editorial's marketing-hero conventions; Dev Tool's dark-first, terminal-cramped density).

The controlling metaphor: **a paper ledger with a wax seal**, not a dashboard. A human "signs" a mandate in this product's own language — the visual system should look like it takes that seriously: rule lines instead of drop shadows, a serif face for money and headings (a signed document has a considered typeface, not a default grotesk), monospace for hashes/run-IDs/DIDs (they *are* code, so they should look like code), and exactly one reserved accent color used sparingly as a "seal," never sprinkled across every button.

**Explicitly rejected:** Glassmorphism (decorative, undercuts trust), Neumorphism (low contrast, dated, bad for glanceability), Brutalist (too maximalist for judges skimming quickly), Retro-futurist/Cyberpunk (wrong personality entirely), Material Design (generic, fights the "unique" requirement), and — the specific thing the user flagged — the generic "AI-generated dashboard" look: purple-to-blue gradients, glassy cards, `hover:scale`/`hover:-translate-y` on everything, oversized rounded corners, shadow-heavy floating cards.

---

## Design Tokens

```
colors:
  paper (background):        #FAF9F6   warm paper white — not clinical #FFFFFF
  surface (panels):          #FFFFFF   one step whiter than the page — panel reads as "the document," page as "the desk"
  surface-sunken (code/table stripe): #F3F1EA
  ink (text-primary):        #1A1D1B
  ink-muted (text-secondary):#62655F
  ink-faint (placeholder):   #8B8D86
  hairline (border):         #E4E1D8   warm gray-beige, not cool gray-200
  hairline-strong (chain rules, section dividers): #C9C4B5
  accent / "seal" (brand, rare use only): #7A2E23   deep oxide / sealing-wax red-brown
  allow (success):           #3F6B4A   muted forest green
  deny (error):              #A23B2E   muted brick red
  step_up (warning):         #9C7A23   muted ochre/gold

typography:
  display (headings, big money figures): "Fraunces" via next/font/google — a characterful serif
                                          with real optical texture; avoids the overused
                                          Playfair-Display-as-default-serif look.
  ui (chrome, labels, nav, body):        "Geist Sans" — already integrated, keep it; no reason
                                          to introduce a second UI face.
  data (hashes, run-IDs, DIDs, timestamps, JSON-shaped values): "Geist Mono" — already
                                          integrated, deliberately reused so the dashboard reads
                                          as "the same real data the terminal UI shows," not a
                                          separate, prettied-up fiction.
  scale (px):   12 / 13 / 15 / 18 / 24 / 34 / 48   — a slightly non-default scale on purpose;
                signals "hand-tuned," not "framework defaults left alone."
  weight:       400 regular (body), 500 medium (labels/nav), 600 semibold (emphasis) — Fraunces
                additionally uses its own 500/600 optical-size-aware weights for display type.
  line-height:  1.5 body (Geist Sans) · 1.15 headings (Fraunces, serif display wants tighter
                leading) · 1.6 data blocks (Geist Mono, hash/JSON legibility)
  numeric:      tabular-nums everywhere a number appears in a column; Fraunces for hero money
                figures, Geist Mono for anything that's an identifier rather than a quantity.

spacing:
  base-unit:    8px (no reason to reinvent this — uniqueness comes from typography/color/
                elevation choices, not from an unusual spacing unit that just adds friction)
  layout:       fixed 240px sidebar + fluid content area (not a centered marketing column —
                this is a dense app shell)
  content max:  1600px soft cap on very large screens, left-aligned within the fluid area
  breakpoints:  640 / 768 / 1024 / 1280 / 1536 (Tailwind defaults)

radius:
  sm: 3px   (inputs, buttons, badges)
  md: 6px   (panels)
  — deliberately small/near-sharp. Large rounded corners (rounded-xl/2xl) are one of the
    clearest "generated dashboard" tells; this system avoids them everywhere, no exceptions.

elevation:
  No drop shadows as a structural device, anywhere. Panels are separated by a 1px hairline
  border plus the paper→surface background step-up, never `shadow-md`/`shadow-lg`. This is a
  deliberate, systemic rule (not a one-off choice) — floating shadowed cards are the single
  most common generated-dashboard signature, and this product's "ledger" metaphor reads better
  as flat paper with rule lines than as UI elements hovering above a page.

motion:
  duration:  120–180ms hover/focus · 300–400ms for the one "big" moment (receipt chain
             breaking during the tamper test — slow enough to actually register as significant)
  easing:    ease-out only; no spring/bounce anywhere
```

## Component Rules (shadcn/ui)

Install via `npx shadcn@latest init`, **"new-york" style preset** as the starting point (its tighter, less-rounded default is a closer base to restyle toward this system than the "default" preset's friendlier rounded look) — then override every color/radius token above into the generated CSS variables. Do not leave any shadcn component at its out-of-the-box color/radius; the whole point is that this doesn't read as a shadcn template.

- **Buttons:** solid ink-filled button reserved for the one real action per view where one exists (e.g., "open the real Dodo checkout link," "copy hash"); everything else is an outline button with an ink border and no fill. The oxide accent appears on at most one element per page (the mandate hero's seal glyph, or the sidebar's active-route indicator) — never as a button-fill color. Most dashboards color every button; this one mostly doesn't, on purpose.
- **Badges (verdict status):** always **icon + text + color**, never color alone (accessibility rule, see below). ALLOW/DENY/STEP_UP each get a distinct glyph (check / cross / arrow-up-right) plus their muted fill from the token set above — never the default shadcn badge's bright saturated colors.
- **Tables (`/events`):** tabular-nums, Geist Mono for id/timestamp/hash columns, hairline row dividers, **no zebra striping** (reads as noisy against the paper background), a 2px left-edge color bar per row carrying the verdict color — a small, functional, positional use of color instead of a loud badge chip on every row.
- **Cards/Panels:** shadcn `Card`, restyled to hairline-border-only, `md` radius, `surface` background on `paper` page background — never a shadow prop.
- **Navigation:** shadcn's `Sidebar` block, restyled to this token set — icon + label items; the active route gets a 2px oxide **rule line** on its left edge (not a filled color block), echoing the ledger-line motif used elsewhere.
- **Tooltips:** used for full-hash reveal on truncated hash values (keyboard-focusable, not hover-only) and for explaining the "Concept Preview" pages.
- **Sheet:** the mobile nav drawer (sidebar collapses into this below 768px).
- **Tabs:** flat underline-style only (no pill-shaped tab backgrounds) — e.g., filtering `/events` by verdict.
- **Skeleton:** loading states mirror the final layout shape for every data view; no spinners on primary content.
- **Toast (`sonner`):** one real, functional use — a toast surfaces when a new `DENY` event arrives, since that's the demo's climax moment and deserves a signal beyond a new table row. Restyled to the token palette, not shadcn/sonner defaults.
- **Empty states:** one line of ink-muted text, no illustration, no emoji.

## Interaction & Motion

**Banned outright** (this is the user's explicit ask, enforced as a hard rule for this file, not a suggestion): `hover:scale-*`, `hover:-translate-y-*`/`translate-x-*`, shadow-escalation on hover, "card lifts up" patterns, gradient-sweep/shimmer hovers, spring/bounce easing, confetti or celebration effects, emoji used as icons.

**Used instead:**
- **Hover** = background or border color shift only (150ms ease-out), or an underline that draws in left-to-right via a pseudo-element for text links — motion that reveals "this is interactive," not motion that performs energy.
- **Focus** = a visible 2px outline (ink or oxide), offset 2px, on every interactive element, never suppressed with `outline-none`.
- **New event row arriving** (`/events`): enters from the top via a brief height/opacity transition, pushing existing rows down — like a new line being written at the top of a ledger — never a bounce or a side-slide.
- **Receipt chain integrity** (`/receipts`) — the one moment worth spending real animation budget on: the connecting rule-line between two receipt panels changes from a solid ink line to a visibly broken/dashed deny-red line, and the affected chain-link glyph recolors, within one poll cycle of a real tamper-test file edit. This is a direct visualization of a real state change, not decoration.
- **Balance gauge / expiry ring:** fills via a `stroke-dashoffset` transition only when the underlying polled value actually changes on load/update — never a looping or idle animation.
- **`prefers-reduced-motion`:** every transition above degrades to an instant state change, no exceptions, no partial motion left running.

## Accessibility Notes

- Every verdict/status signal is icon **+** text **+** color — triple redundancy, never color-alone, especially given a live-demo audience may include colorblind judges.
- Contrast: `ink` (#1A1D1B) on `paper` (#FAF9F6) is comfortably above WCAG AAA; the `accent`/oxide color is used only for large text, icons, and rule-lines — never for small body text — to stay clear of contrast failure at small sizes.
- Full keyboard path through sidebar nav, tabs, and hash-reveal tooltips (focus-triggered, not hover-only).
- Touch targets ≥40px, relevant mainly to the Phase 3 concept-layer's form-like elements (rule-builder mock).
- `prefers-reduced-motion` respected everywhere, per above.

## Responsive Strategy

- **Desktop-primary** — this is presented on a screen/projector during a live demo, not used one-handed on a phone. Sidebar fixed at 240px ≥1024px.
- **768–1024px:** sidebar collapses to a 64px icon-only rail; labels appear via focus/hover tooltip.
- **<768px:** sidebar becomes the `Sheet` slide-over; navbar shows a menu trigger.
- **`/events`' table** collapses to stacked, hairline-divided card-per-row below 640px (no shadowed cards even in the stacked view — same elevation rule applies).
- **No ultra-wide-specific layout** — content area soft-caps at 1600px so table/line legibility doesn't degrade on very large displays, without reintroducing a narrow centered marketing column.

---

## Layout System — Navbar + Sidebar Shell

- **Top navbar (56px):** left — wordmark "Mandate Gate" set in Fraunces, with a small oxide seal glyph beside it (the one other place, besides page content, the accent color appears). Right — a redesigned **"TEST MODE"** indicator (a small stamped/seal-style badge rather than the current amber warning strip — keeps the honesty requirement front and center, but makes it feel like a deliberate design element instead of a leftover dev banner) plus a live connection-status dot reflecting whether the events poll is currently succeeding.
- **Left sidebar (240px / 64px collapsed):** real pages first, in this order — **Mandate, Events, Receipts**. Then a hairline divider and a smaller, ink-muted **"Concept Preview"** section heading, under which the Phase 3 pages live (Compare, Rule Builder, Timeline) — positioned so a judge can never mistake "real" for "illustrative" just from where something sits in the nav. A slim, always-visible reserve-balance mini-stat is pinned at the sidebar's bottom (real data, no need to navigate to `/` to see it).
- **Main content:** below the navbar, right of the sidebar, 32px desktop padding. Every page opens with a Fraunces page title and a one-line ink-muted description underneath — written for narration clarity during the live demo, not just as a heading.

## Page-by-page (bridges to the Plan Phase 2/3 checklists in `docs/common/09-HACKATHON-WOW-PLAN.md`)

- **Shell:** navbar + sidebar as above, applied in `app/layout.tsx`.
- **`/` — Mandate:** hero panel with the cap amount set in Fraunces and a faint oxide seal watermark; an expiry `stroke-dashoffset` ring; a reserve-balance gauge fed by the real Dodo balance; merchants shown as ink-outlined chips (not filled-color pills); the TEST MODE seal badge from the navbar echoed here at panel level.
- **`/events`:** the live feed table per Component Rules above; a small running "N ALLOW · N DENY · N STEP_UP" counter in the page header; verdict-filter tabs (flat underline style).
- **`/receipts`:** each receipt renders as its own ledger-entry panel; a connecting rule-line between consecutive receipts is the chain visualization, breaking per the Motion section above when a tamper test invalidates it.
- **`/concept/compare`, `/concept/rules`, `/concept/timeline`** (Phase 3, later): same token system, static/sample data, a persistent "Concept Preview — not live" tag at the same visual weight as the navbar's TEST MODE badge — this labeling is a hard requirement carried from `09-HACKATHON-WOW-PLAN.md`, not optional polish.

## Implementation notes specific to this codebase

- Tailwind here is **v4**, CSS-first config — there is no `tailwind.config.ts`; tokens get added as CSS variables inside `app/globals.css`'s `@theme inline` block (the file already has `--color-background`/`--color-foreground`/`--font-sans`/`--font-mono` wired this way — extend it, don't replace the mechanism).
- `app/globals.css` currently auto-switches to a dark palette via `@media (prefers-color-scheme: dark)`. Since the explicit ask is a white/paper theme (not a theme that flips depending on the judges' OS setting), **remove that dark-mode media query** for this build rather than trying to also design and maintain a second dark token set no one asked for.
- Fraunces is added the same way Geist already is — via `next/font/google` in `app/layout.tsx` — no new npm package for the font itself.
- shadcn/ui's own install brings `radix-ui` primitives, `class-variance-authority`, `tailwind-merge`, `clsx`, and `lucide-react` as transitive/companion dependencies — expected and fine, these are what "use shadcn" means in practice.

## Package additions (to log as a short ADR alongside implementation, per `CLAUDE.md` rule 5 — user has authorized "other packages," this just keeps the paper trail the rest of the project already keeps)

- `shadcn/ui` (+ Radix primitives, `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`) — direct user instruction; also explicitly allowed as "optional polish" by `docs/06-DASHBOARD-SPEC.md`.
- `lucide-react` — shadcn's default icon set; plain line icons, satisfies the "no emoji as icons" rule.
- `sonner` — the one toast (new-DENY signal); small, shadcn-recommended, avoids hand-rolling a toast stack.
- `recharts` — **Phase 3 only**, for the sample savings/timeline chart; Phase 2 needs no charting library at all. Deferred, not installed yet.
- **Deliberately not adding:** `framer-motion`. Every motion spec above is achievable with Tailwind's `transition-*`/`animate-*` utilities and a handful of custom `@keyframes`; skipping it keeps the bundle light and keeps motion tied to real state changes rather than inviting decorative use.

---

## Open Questions — please confirm before implementation starts

1. **Fraunces** as the display serif — good, or would a different characterful serif (Newsreader, Source Serif 4, Instrument Serif) fit your taste better?
2. The single reserved accent — **oxide/sealing-wax (#7A2E23)** — acceptable? (Chosen specifically to stay outside the green/red/amber verdict trio; alternatives in that same "outside the trio" constraint would be a deep teal or a plain ink-only system with zero color accent at all.)
3. OK to add `lucide-react` + `sonner` alongside `shadcn/ui` now, and defer `recharts` to Phase 3? Or would you rather scope Phase 2 to shadcn + Tailwind only, no extras yet?
4. Confirm the sidebar should visually separate real pages from "Concept Preview" pages (a deliberate honesty-driven choice carried from `09-HACKATHON-WOW-PLAN.md`) — yes, or did you have a different way in mind to distinguish real vs. illustrative?
