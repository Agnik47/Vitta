// One place for the "could not add to cart" toast, so every add button explains a refusal the same way.
import { toast } from "sonner";

/** A gate refusal caused by the mandate (none / expired / bad signature / wrong merchant) can only be
 *  fixed on the Mandate page, so the toast offers to go there. */
const MANDATE_PROBLEM = /mandate/i;

export function toastCartError(title: string, message?: string): void {
  if (message && MANDATE_PROBLEM.test(message)) {
    toast.error(title, {
      description: message,
      action: { label: "Open Mandate", onClick: () => window.location.assign("/mandate") },
      duration: 10_000,
    });
    return;
  }
  toast.error(title, { description: message });
}
