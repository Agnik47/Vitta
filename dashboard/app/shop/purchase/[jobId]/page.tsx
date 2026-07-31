"use client";

// The Purchase Job's own live-progress + result page. The URL's jobId is the ONLY source of truth
// for which job this page shows — nothing here derives progress from local/React state carried over
// from the cart or search pages. A refresh, a shared link, or landing here directly all behave
// identically: fetch the real job by id and poll it. See src/agent/PurchaseAgent.ts for the pipeline
// itself and dashboard/app/api/shop/purchase-run/route.ts for the job store this polls.
//
// Two-stage tracking: Transaction Authorization (decide() ALLOW + real reserve check, real and
// signed the moment it happens, before the browser ever touches the merchant) and Merchant
// Confirmation (only real once the merchant itself proves an order exists) are shown as separate,
// independently-real milestones — never collapsed into one claim. See src/receipt/authorization.ts.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Loader2,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { MERCHANT_LABEL } from "@/lib/shop-catalog";

interface StepEvent {
  type: "step";
  step: string;
  status: "running" | "done" | "skipped" | "failed";
  detail: string;
  timestamp: string;
}

interface ResultEvent {
  type: "result";
  ok: boolean;
  merchant?: string;
  productName?: string;
  verdict?: "ALLOW" | "DENY" | "STEP_UP";
  denyCode?: string;
  authorizationId?: string;
  awaitingMerchantConfirmation?: boolean;
  receiptId?: string;
  orderId?: string;
  commitProof?: string;
  handoff?: boolean;
  finalAmountInr?: number;
  paymentStatus?: "captured" | "not_charged";
  failureReason?: string;
  completedAt?: string;
}

interface JobPoll {
  ok: boolean;
  status: "running" | "done" | "failed";
  state?: string;
  events: Array<StepEvent | ResultEvent>;
  result?: ResultEvent;
  startedAt: string;
  finishedAt?: string;
}

interface ReceiptVerification {
  receipt_id: string;
  signature_valid: boolean;
  chain_link_valid: boolean;
}

interface ReceiptDetail {
  receipt_id: string;
  sig: string;
  signed_at: string;
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: string; status: string };
  evidence: { trace_digest: string; network_order_id?: string; commit_proof?: string };
}

interface ReceiptRow {
  receipt: ReceiptDetail;
  verification: ReceiptVerification | null;
}

interface AuthorizationDetail {
  authorization_id: string;
  run_id: string;
  mandate_id: string;
  merchant: string;
  cart: { items: number; total_inr: number };
  reserve_verified_inr: number;
  authorized_at: string;
  sig: string;
}

interface AuthorizationRow {
  authorization: AuthorizationDetail;
  signature_valid: boolean | null;
}

const STEP_LABEL: Record<string, string> = {
  precondition: "Checking merchant setup",
  "clear-cart": "Clearing previous session's cart",
  "add-to-cart": "Adding to real cart",
  "verify-cart": "Verifying real cart",
  "order-value-check": "Checking minimum/maximum order value",
  fund: "Funding reserve",
  commit: "Mandate Gate decision",
  authorize: "Mandate Gate authorization",
  "merchant-confirm": "Waiting for merchant confirmation",
  draw: "Drawing from reserve",
  confirm: "Signing receipt",
};

function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function StepIcon({ status }: { status: StepEvent["status"] }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-seal" strokeWidth={2} />;
  if (status === "done") return <CheckCircle2 className="size-4 text-allow" strokeWidth={2.25} />;
  if (status === "skipped") return <Circle className="size-4 text-ink-faint" strokeWidth={1.75} />;
  return <XCircle className="size-4 text-deny" strokeWidth={2.25} />;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest text-ink-faint uppercase">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function MilestoneBadge({
  achieved,
  pending,
  label,
  pendingLabel,
}: {
  achieved: boolean;
  /** Shown instead of a dim/absent badge when this milestone hasn't happened yet but genuinely
   *  might still (as opposed to being simply not applicable to this outcome). */
  pending?: boolean;
  label: string;
  pendingLabel?: string;
}) {
  if (achieved) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-allow/40 bg-allow/10 px-2.5 py-1 text-xs font-medium text-allow">
        <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
        {label}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-step-up/40 bg-step-up/10 px-2.5 py-1 text-xs font-medium text-step-up">
        <Clock className="size-3.5" strokeWidth={2} />
        {pendingLabel ?? label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs font-medium text-ink-faint">
      <Circle className="size-3.5" strokeWidth={1.75} />
      {label}
    </span>
  );
}

export default function PurchaseJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [job, setJob] = useState<JobPoll | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [receiptRow, setReceiptRow] = useState<ReceiptRow | null>(null);
  const [authorizationRow, setAuthorizationRow] = useState<AuthorizationRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    async function poll() {
      try {
        const res = await fetch(`/api/shop/purchase-run?id=${jobId}`);
        if (res.status === 404) {
          setNotFound(true);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }
        const json: JobPoll = await res.json();
        setJob(json);
        if (json.status !== "running" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            // Keyed off the real state, not the coarse status — an authorized-but-not-yet-
            // merchant-confirmed run is neither a success nor an error; it's an honest "still
            // waiting on you" state, and framing it as either would misrepresent what happened.
            if (json.state === "RECEIPT_READY") {
              toast.success("Purchase complete", { description: json.result?.receiptId });
            } else if (json.state === "WAITING_FOR_MERCHANT_CONFIRMATION") {
              toast.info("Authorized — waiting for merchant confirmation", {
                description: "The mandate approved this spend. Complete checkout in the merchant's browser window to finish.",
              });
            } else if (json.state === "MERCHANT_CONFIRMED") {
              toast.success("Merchant confirmed — one click left", { description: "This merchant has no order-placing command; finish it yourself." });
            } else {
              toast.error("Purchase did not complete", { description: json.result?.failureReason });
            }
          }
        }
      } catch {
        // A transient poll failure isn't fatal — the next tick tries again.
      }
    }
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  // Once the job names a real signed receipt, fetch its real signature/chain verification for the
  // success panel — never fabricated, the same /api/receipts route /receipts itself uses.
  useEffect(() => {
    const receiptId = job?.result?.receiptId;
    if (!receiptId) return;
    let cancelled = false;
    fetch("/api/receipts")
      .then((r) => r.json())
      .then((rows: ReceiptRow[]) => {
        if (cancelled) return;
        const match = rows.find((row) => row.receipt.receipt_id === receiptId);
        if (match) setReceiptRow(match);
      })
      .catch(() => {
        // Non-fatal — the result panel below degrades to showing the receipt id without the extra
        // signature/verification detail rather than blocking on this.
      });
    return () => {
      cancelled = true;
    };
  }, [job?.result?.receiptId]);

  // Same pattern for the earlier Transaction Authorization — real, signed, fetched independently of
  // whether the merchant ever confirmed anything.
  useEffect(() => {
    const authorizationId = job?.result?.authorizationId;
    if (!authorizationId) return;
    let cancelled = false;
    fetch("/api/shop/authorizations")
      .then((r) => r.json())
      .then((rows: AuthorizationRow[]) => {
        if (cancelled) return;
        const match = rows.find((row) => row.authorization.authorization_id === authorizationId);
        if (match) setAuthorizationRow(match);
      })
      .catch(() => {
        // Non-fatal — the milestone badge still shows "authorized" from the job result alone.
      });
    return () => {
      cancelled = true;
    };
  }, [job?.result?.authorizationId]);

  function handleDownloadReceipt() {
    if (!receiptRow) return;
    const blob = new Blob([JSON.stringify(receiptRow.receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${receiptRow.receipt.receipt_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Purchase" description="This purchase job could not be found." />
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <XCircle className="size-6 text-deny" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              Unknown job id — it may be wrong, or the server that ran it has since restarted.
            </p>
            <Button asChild variant="outline">
              <Link href="/shop/cart">
                <ArrowLeft className="size-4" /> Back to cart
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} /> Loading your purchase…
      </div>
    );
  }

  const steps = job.events.filter((e): e is StepEvent => e.type === "step");
  const result = job.result;
  const merchantLabel =
    result?.merchant && result.merchant in MERCHANT_LABEL
      ? MERCHANT_LABEL[result.merchant as keyof typeof MERCHANT_LABEL]
      : (result?.merchant ?? "—");

  // The three real, independent milestones this job can reach — never inferred beyond what the
  // real result/state actually says.
  const authorized = Boolean(result?.authorizationId);
  const merchantConfirmed =
    Boolean(result?.receiptId) || Boolean(result?.ok && !result?.awaitingMerchantConfirmation && authorized);
  const receiptReady = Boolean(result?.receiptId);
  const awaitingConfirmation = Boolean(result?.awaitingMerchantConfirmation);

  // Overall banner framing — a genuine three-way split, not a collapsed success/fail binary.
  let bannerTone: "allow" | "waiting" | "deny" = "deny";
  let bannerLabel = "Purchase failed";
  if (receiptReady) {
    bannerTone = "allow";
    bannerLabel = "VERIFIED SUCCESS";
  } else if (awaitingConfirmation) {
    bannerTone = "waiting";
    bannerLabel = "Authorized — waiting for merchant confirmation";
  } else if (result?.ok) {
    bannerTone = "allow";
    bannerLabel = "Merchant confirmed — awaiting your final click";
  }

  return (
    <div>
      <PageHeader
        title="Purchase"
        description="This page always reflects the real Purchase Job — refreshing or reopening this link shows the same live state, not a cached one."
      />

      <div className="flex flex-col gap-4">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">Execution Progress Timeline</div>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              State: {job.state ?? "PENDING"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {steps.length === 0 && (
              <div className="flex items-center gap-2 py-2 pl-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-seal" strokeWidth={2} /> Initializing automation pipeline…
              </div>
            )}

            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{STEP_LABEL[step.step] ?? step.step}</div>
                  <div className="text-xs text-muted-foreground">{step.detail}</div>
                </div>
                <span className="font-mono text-[10px] text-ink-faint">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {result && (
          <Panel>
            <div
              className={`mb-4 flex items-center gap-2 border px-4 py-3 ${
                bannerTone === "allow"
                  ? "border-allow/30 bg-allow/5"
                  : bannerTone === "waiting"
                    ? "border-step-up/30 bg-step-up/5"
                    : "border-deny/30 bg-deny/5"
              }`}
            >
              {bannerTone === "allow" && <CheckCircle2 className="size-5 text-allow" strokeWidth={2.25} />}
              {bannerTone === "waiting" && <Clock className="size-5 text-step-up" strokeWidth={2.25} />}
              {bannerTone === "deny" && <XCircle className="size-5 text-deny" strokeWidth={2.25} />}
              <span className="text-sm font-semibold text-foreground">{bannerLabel}</span>
            </div>

            {/* The two-stage tracking model itself: three independent, honestly-labeled facts. */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <MilestoneBadge achieved={authorized} label="Transaction Authorized" />
              <MilestoneBadge
                achieved={merchantConfirmed}
                pending={awaitingConfirmation}
                label="Merchant Order Confirmed"
                pendingLabel="Waiting for Merchant Confirmation"
              />
              <MilestoneBadge achieved={receiptReady} label="Receipt Generated" />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Field label="Marketplace" value={merchantLabel} />
              <Field label="Product" value={result.productName ?? "—"} />
              <Field label="Amount" value={result.finalAmountInr !== undefined ? rupees(result.finalAmountInr) : "—"} />
              <Field label="Order ID" value={result.orderId ?? (result.commitProof ? `(${result.commitProof})` : "not yet provided by merchant")} />
              <Field label="Payment status" value={result.paymentStatus === "captured" ? "Captured" : "Not charged"} />
              <Field label="Gate verdict" value={result.verdict ?? "—"} />
              <Field
                label="Receipt"
                value={
                  result.receiptId ? (
                    <Link href="/receipts" className="text-seal underline underline-offset-2">
                      {result.receiptId}
                    </Link>
                  ) : (
                    "none signed yet"
                  )
                }
              />
              <Field
                label="Receipt signature"
                value={
                  receiptRow ? (
                    <span className="break-all">{receiptRow.receipt.sig.slice(0, 24)}…</span>
                  ) : result.receiptId ? (
                    "loading…"
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Receipt verification"
                value={
                  receiptRow?.verification ? (
                    <span
                      className={`inline-flex items-center gap-1 ${
                        receiptRow.verification.signature_valid && receiptRow.verification.chain_link_valid
                          ? "text-allow"
                          : "text-deny"
                      }`}
                    >
                      {receiptRow.verification.signature_valid && receiptRow.verification.chain_link_valid ? (
                        <ShieldCheck className="size-3.5" strokeWidth={2} />
                      ) : (
                        <ShieldX className="size-3.5" strokeWidth={2} />
                      )}
                      {receiptRow.verification.signature_valid ? "Signature valid" : "Signature invalid"} ·{" "}
                      {receiptRow.verification.chain_link_valid ? "chain intact" : "chain broken"}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Timestamp" value={result.completedAt ? new Date(result.completedAt).toLocaleString() : "—"} />
            </div>

            {/* Transaction Authorization detail — real and independent of merchant confirmation. */}
            {result.authorizationId && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  Transaction Authorization
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <Field label="Authorization ID" value={result.authorizationId} />
                  <Field
                    label="Reserve verified"
                    value={authorizationRow ? rupees(authorizationRow.authorization.reserve_verified_inr) : "loading…"}
                  />
                  <Field
                    label="Authorized at"
                    value={authorizationRow ? new Date(authorizationRow.authorization.authorized_at).toLocaleString() : "loading…"}
                  />
                  <Field
                    label="Authorization signature"
                    value={
                      authorizationRow ? (
                        <span
                          className={`inline-flex items-center gap-1 ${authorizationRow.signature_valid ? "text-allow" : "text-deny"}`}
                        >
                          {authorizationRow.signature_valid ? (
                            <ShieldCheck className="size-3.5" strokeWidth={2} />
                          ) : (
                            <ShieldX className="size-3.5" strokeWidth={2} />
                          )}
                          {authorizationRow.signature_valid ? "Signature valid" : "Signature invalid"}
                        </span>
                      ) : (
                        "loading…"
                      )
                    }
                  />
                </div>
                <p className="mt-2 text-[11px] text-ink-faint">
                  This confirms the mandate authorized the spend and the reserve covered it — it does not by itself
                  mean the merchant accepted an order or that any money moved.
                </p>
              </div>
            )}

            {!result.ok && result.failureReason && <p className="mt-4 text-xs text-deny">{result.failureReason}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <Link href="/events" className="text-seal underline underline-offset-2">
                View the full gate/mandate decision log
              </Link>
              {receiptRow && (
                <Button variant="outline" size="sm" onClick={handleDownloadReceipt} className="h-7 gap-1.5">
                  <Download className="size-3.5" strokeWidth={1.75} />
                  Download receipt
                </Button>
              )}
              {!result.ok && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/shop/cart">Back to cart to retry</Link>
                </Button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
