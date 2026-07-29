import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The one elevation treatment used everywhere in this app: a hairline border
 * on the "paper" background, never a drop shadow. See dashboard/DESIGN.md
 * § Design Tokens — elevation. Wraps shadcn's Card once here rather than
 * repeating the override className at every call site.
 */
export function Panel({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("gap-4 rounded-md border border-border bg-card px-5 py-5 ring-0 shadow-none", className)}
      {...props}
    />
  );
}

export { CardContent as PanelContent, CardHeader as PanelHeader, CardTitle as PanelTitle, CardDescription as PanelDescription };
