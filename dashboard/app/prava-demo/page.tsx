'use client';

import { useState } from 'react';
import { SetupMandateButton } from '@/components/SetupMandateButton';
import { ExecuteJobButton } from '@/components/ExecuteJobButton';
import { PageHeader } from '@/components/layout/page-header';
import { ShieldCheck, Zap } from 'lucide-react';

export default function PravaDemoPage() {
  const [email, setEmail] = useState('user@example.com');
  const [subscriptionId, setSubscriptionId] = useState('');

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <PageHeader
        title="Prava Payments Zero-Click Demo"
        description="Test the zero-click mandate flow using Prava Payments. First, save your card. Then, automatically charge it."
      />

      {/* Step 1: Setup Mandate */}
      <section className="flex flex-col gap-4 border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="text-seal" /> 
          Step 1: Setup Payment Mandate
        </div>
        <p className="text-sm text-muted-foreground">
          This is the only time you will see a checkout page. You enter your email, click the button, and Prava securely saves your card details into a mandate.
        </p>
        
        <div className="flex flex-col gap-2 max-w-sm mt-4">
          <label className="text-xs font-medium">Customer Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="mt-2">
          <SetupMandateButton email={email} />
        </div>
      </section>

      {/* Step 2: Zero Click Charge */}
      <section className="flex flex-col gap-4 border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="text-orange-500" /> 
          Step 2: Zero-Click Background Charge
        </div>
        <p className="text-sm text-muted-foreground">
          Once you return from the checkout, you will have a <code>subscription_id</code>. Paste it below to test charging your saved card in the background. No checkout page will appear!
        </p>

        <div className="flex flex-col gap-2 max-w-sm mt-4">
          <label className="text-xs font-medium">Subscription ID (from Prava dashboard/webhook)</label>
          <input 
            type="text" 
            placeholder="sub_xxxxxxxxxxxx"
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="mt-2">
          <ExecuteJobButton subscriptionId={subscriptionId} amountInCents={1500} />
          <p className="text-xs text-muted-foreground mt-2">
            This will instantly charge $15.00.
          </p>
        </div>
      </section>
    </div>
  );
}
