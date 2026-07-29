import { FlaskConical } from "lucide-react";

/**
 * The same visual weight as the navbar's TEST MODE badge, deliberately — a
 * judge glancing at either should immediately register "this one isn't
 * live." See docs/common/09-HACKATHON-WOW-PLAN.md § Phase 3 and
 * dashboard/DESIGN.md's labeling requirement.
 */
export function ConceptPreviewBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-step-up/50 px-2 py-1 text-[11px] font-medium tracking-wide text-step-up uppercase">
      <FlaskConical className="size-3.5" strokeWidth={2} />
      Concept preview — not live
    </span>
  );
}
