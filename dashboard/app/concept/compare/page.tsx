import { Columns3 } from "lucide-react";
import { ConceptPlaceholder } from "@/components/shared/concept-placeholder";

export default function ComparePage() {
  return (
    <ConceptPlaceholder
      icon={Columns3}
      title="Marketplace comparison"
      description="Blinkit, Zepto, BigBasket, and Instamart side by side — listed price, fees, and final checkout cost."
      hint="Sample-data mockup of PRODUCT_FEATURE.md's shopping-agent vision, not wired to any live source."
    />
  );
}
