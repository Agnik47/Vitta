import { PageHeader } from "@/components/layout/page-header";
import { ConceptPreviewBadge } from "@/components/shared/concept-preview-badge";
import { RuleBuilderForm } from "@/components/concept/rule-builder-form";

export default function RuleBuilderPage() {
  return (
    <div>
      <PageHeader
        title="Shopping rule builder"
        description="Product, target price, budget, merchants, and expiry — the concept that eventually becomes a real signed mandate."
        action={<ConceptPreviewBadge />}
      />
      <RuleBuilderForm />
    </div>
  );
}
