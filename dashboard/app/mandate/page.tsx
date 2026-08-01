"use client";

// The one place a mandate is created, funded and inspected.
//
// Both spending paths in this app depend on it: the cart's "Proceed to purchase" and any Price
// Sniper watch. It lives at the top level rather than under /shop because a mandate is not a
// shopping step — it is the authority every purchase is checked against.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MandateHero } from "@/components/mandate/mandate-hero";
import { CreateMandateForm } from "@/components/mandate/create-mandate-form";
import { FundMandateForm } from "@/components/mandate/fund-mandate-form";
import { usePolledFetch } from "@/hooks/use-polling";
import type { Mandate } from "@/lib/types";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;
type MandateApiResponse = { mandate: Mandate | null; balance: Balance };

export default function MandatePage() {
  const { data } = usePolledFetch<MandateApiResponse>("/api/mandate", 4000);
  const [refreshTick, setRefreshTick] = useState(0);

  // Date.now() deferred to an effect, not called during render — same SSR-safe pattern as
  // mandate/expiry-ring.tsx. Starts non-expired so a valid mandate isn't briefly shown as expired
  // on the very first paint.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  const mandate = data?.mandate ?? null;
  const balance = data?.balance ?? null;
  const expired = mandate && now !== null ? new Date(mandate.scope.expires_at).getTime() <= now : false;
  const funded = mandate ? balance?.available === true && balance.balanceInr > 0 : false;

  return (
    <div key={refreshTick}>
      <PageHeader
        title="Mandate"
        description="The signed spending authority every purchase is checked against — from the cart and from any price watch."
      />

      {!mandate || expired ? (
        <>
          {expired && (
            <div className="mb-4 flex items-start gap-2.5 border border-step-up/30 bg-step-up/5 px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-step-up" strokeWidth={1.75} />
              <span>
                Your last mandate has expired, so nothing can be bought right now. Creating a new one below replaces it.
              </span>
            </div>
          )}
          <CreateMandateForm onCreated={() => setRefreshTick((t) => t + 1)} />
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <MandateHero mandate={mandate} balance={balance} />

          {!funded && <FundMandateForm mandateId={mandate.mandate_id} onFunded={() => setRefreshTick((t) => t + 1)} />}

          {funded && (
            <p className="text-xs text-ink-faint">
              Ready to spend within these limits. Build a cart on{" "}
              <Link href="/shop" className="text-seal underline underline-offset-2">
                Search &amp; compare
              </Link>
              , or set a{" "}
              <Link href="/shop/sniper" className="text-seal underline underline-offset-2">
                price watch
              </Link>{" "}
              to buy automatically when a price drops.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
