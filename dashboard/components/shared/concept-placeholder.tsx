import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ConceptPreviewBadge } from "@/components/shared/concept-preview-badge";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Shared shell for the three not-yet-built Phase 3 concept pages — see
 * docs/common/09-HACKATHON-WOW-PLAN.md Plan Phase 3. Placeholder only, so the
 * sidebar's Concept Preview section doesn't 404; the real mocked content
 * (marketplace comparison, rule builder, savings timeline) lands separately.
 */
export function ConceptPlaceholder({
  title,
  description,
  icon,
  hint,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  hint: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} action={<ConceptPreviewBadge />} />
      <EmptyState icon={icon} title="Coming in Phase 3" hint={hint} />
    </div>
  );
}
