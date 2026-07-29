import { SlidersHorizontal } from "lucide-react";
import { ConceptPlaceholder } from "@/components/shared/concept-placeholder";

export default function RuleBuilderPage() {
  return (
    <ConceptPlaceholder
      icon={SlidersHorizontal}
      title="Shopping rule builder"
      description="Product, target price, budget, merchants, and expiry — the concept that eventually becomes a real signed mandate."
      hint="A local-state mock only — this app never creates a mandate; that stays exclusively a `gate` CLI action."
    />
  );
}
