"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PravaSDK } from "@prava-sdk/core";
import { Button } from "@/components/ui/button";

export default function CardsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<PravaSDK | null>(null);
  const [busy, setBusy] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string; enrollmentId: string } | null>(null);

  useEffect(() => {
    // Check local storage for an existing card
    const existing = localStorage.getItem("prava_saved_card");
    if (existing) {
      try {
        setSavedCard(JSON.parse(existing));
      } catch (e) {}
    }
  }, []);

  // Auto-mount the card iframe as soon as the page loads (if no card is saved)
  useEffect(() => {
    if (savedCard || !containerRef.current || sdkRef.current) return;

    let isMounted = true;

    async function initializeCardForm() {
      try {
        // 1. Create a session on the backend silently
        const res = await fetch("/api/prava/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const session = await res.json();
        
        if (!res.ok) throw new Error(session.error || "Failed to create session");
        if (!isMounted) return;

        // 2. Initialize SDK
        const sdk = new PravaSDK({ publishableKey: session.publishable_key || "pk_test_xxx" });
        sdkRef.current = sdk;

        // 3. Mount iframe instantly so user sees the card fields
        sdk.collectPAN({
          sessionToken: session.session_token,
          iframeUrl: session.iframe_url,
          container: containerRef.current,
          onReady: () => {
            if (isMounted) setIframeReady(true);
          },
          onChange: (state) => {
            if (isMounted) setIsFormValid(state.isComplete);
          },
          onSuccess: (data: any) => {
            const cardData = {
              last4: data.last4,
              brand: data.brand,
              enrollmentId: data.enrollmentId || session.session_id // Fallback to session ID
            };
            setSavedCard(cardData);
            localStorage.setItem("prava_saved_card", JSON.stringify(cardData));
            toast.success(`Card ${data.brand} ending in ${data.last4} saved securely!`);
            
            // Cleanup
            sdk.destroy();
            sdkRef.current = null;
            if (isMounted) {
              setIframeReady(false);
              setBusy(false);
            }
          },
          onError: (err: any) => {
            if (isMounted) setInitError(err.message);
          },
        });

      } catch (err: any) {
        if (isMounted) setInitError(err.message);
      }
    }

    initializeCardForm();

    return () => {
      isMounted = false;
      if (sdkRef.current) {
        sdkRef.current.destroy();
        sdkRef.current = null;
      }
    };
  }, [savedCard]);

  const handleRemoveCard = () => {
    localStorage.removeItem("prava_saved_card");
    setSavedCard(null);
    setIframeReady(false);
    toast.success("Saved card removed.");
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <PageHeader
        title="Payment Methods"
        description="Securely save a credit card for one-click mandate creation and agent spending."
      />

      {savedCard ? (
        <div className="flex flex-col gap-4 border border-border bg-card p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 text-lg font-medium">
            <ShieldCheck className="size-6 text-green-500" />
            Active Payment Method
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded border border-border/50">
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-muted-foreground" />
              <div>
                <div className="font-medium capitalize">{savedCard.brand} Card</div>
                <div className="text-sm text-muted-foreground">•••• •••• •••• {savedCard.last4}</div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleRemoveCard}>Remove</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This card is securely vaulted by Prava Payments and will be automatically used when you create new mandates.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 border border-border bg-card p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-seal" />
            <span className="text-sm font-medium">Add New Credit Card</span>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Enter your card details below. This form is securely hosted by Prava Payments. Your raw card details never touch our servers.
          </p>

          {initError ? (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded border border-red-500/20">
              Failed to load secure card form: {initError}
            </div>
          ) : (
            <>
              {/* This container holds the Prava iframe with Card Number, Expiry, CVV */}
              <div 
                ref={containerRef} 
                className={`w-full transition-all duration-300 ${iframeReady ? 'min-h-[120px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}
              />
              
              {!iframeReady && <div className="text-sm text-muted-foreground animate-pulse">Loading secure payment form...</div>}
              
              {iframeReady && (
                <div className="flex items-center justify-between mt-4 border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">
                    {isFormValid ? "Card looks good! Submitting..." : "Please fill out all fields securely."}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
