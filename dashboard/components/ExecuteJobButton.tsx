'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface ExecuteJobButtonProps {
  subscriptionId: string; // The saved mandate ID from the setup flow
  amountInCents: number;
}

export function ExecuteJobButton({ subscriptionId, amountInCents }: ExecuteJobButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    
    try {
      // 1. First, execute whatever job/action the user requested in your system
      // ... (your internal logic here) ...

      // 2. Then, seamlessly charge them for it using Prava without a checkout page!
      const response = await fetch('/api/prava/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscriptionId, 
          amountInCents,
          description: 'Payment for executed background job'
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(`Successfully charged $${(amountInCents / 100).toFixed(2)} in the background!`);
      } else {
        throw new Error(data.error || 'Charge failed');
      }
    } catch (error) {
      console.error('Zero-click charge error:', error);
      toast.error('Failed to execute automatic charge.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleExecute} 
      disabled={loading || !subscriptionId} 
      variant="secondary"
      className="w-full max-w-sm"
    >
      {loading ? 'Processing...' : `Run Job & Charge $${(amountInCents / 100).toFixed(2)}`}
    </Button>
  );
}
