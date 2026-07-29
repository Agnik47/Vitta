# demo/ — fallback recording

## `mandate-gate-fallback-2026-07-29.mp4`

The fallback recording required by `docs/05-DEMO-SCRIPT.md`'s acceptance checklist ("a fallback recording of this exact sequence exists on disk, dated, before 31 Jul night"). Play this if the live demo can't run on 1 Aug — venue wifi down, a merchant site misbehaving, a stale login, anything.

**4m32s · 1920×1080 · H.264/AAC · built 2026-07-29.**

### What it is

A **narrated replay** of the real Beats 1-8 run performed on 2026-07-29. Every line of terminal output shown is real, previously-captured output from that run — the same output pasted verbatim into `docs/OUTCOME.md`'s Phase 1g section. The real artifacts behind it:

- real mandate `mnd_ms65y5egd7e7229c47a6` (Ed25519-signed)
- real Dodo test-mode checkout `cks_0NkEvKofSCvb33CvbrQVl`, real ledger draw ₹1,800 → ₹1,324
- real Blinkit order, ₹476, on a real logged-in account
- real signed receipt `rcp_ms66xl2ef9771fa00056`, real trace digest, real tamper test

### What it is NOT — read this before showing it to anyone

- **It is not a live screen capture.** The run itself was real; this video is a reconstruction of it, rendered from the captured output, with synthesized narration. The frames are generated images of real text, not a recording of the terminal as it ran. The video says so explicitly on its own title card — deliberately, since this project's whole pitch is that it doesn't fake the parts that matter.
- **Its 4m32s runtime is not the demo script's "under 4 minutes" metric.** That checklist item measures a *live run*; narration is inherently slower than just executing the commands. Timing a real run is still an open item — see `docs/05-DEMO-SCRIPT.md`.
- **Beat 8 shows `TXN_LIMIT_REACHED`, not `ALREADY_EXECUTED`.** That is what really happened (the mandate's `max_txns: 1` was already consumed, so `decide()` denied before the idempotency guard was reached). The narration explains this rather than glossing it. See `docs/OUTCOME.md` Phase 1g addendum and ADR-011.

### Rebuilding it

The build scripts (scene definitions, SVG renderer, TTS narration, ffmpeg assembly) were scratch tooling, not committed — they're one-shot and depend on this machine's ffmpeg/Chrome/Windows-TTS. If the video needs regenerating, the source of truth for its content is `docs/OUTCOME.md`'s Phase 1g section; rebuilding from that is straightforward.

**If a second real purchase is ever authorized**, prefer recording *that* live instead — a genuine screen capture beats a reconstruction, and would close the timing checklist item at the same time.
