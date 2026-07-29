import { History } from "lucide-react";
import { ConceptPlaceholder } from "@/components/shared/concept-placeholder";

export default function TimelinePage() {
  return (
    <ConceptPlaceholder
      icon={History}
      title="Activity timeline"
      description="Search → compare → checkout → mandate approval → payment → receipt, as one visual timeline."
      hint="Will blend real receipt/event data with clearly-labeled sample data where the real path doesn't exist yet."
    />
  );
}
