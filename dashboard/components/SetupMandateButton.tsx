'use client';

import { useState } from 'react';
import { Button } from './ui/button';

interface SetupMandateButtonProps {
  email: string;
}

export function SetupMandateButton({ email }: SetupMandateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSetupMandate = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/prava/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (data.checkoutUrl) {
        // Redirect the user to the Prava checkout to securely save their card
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Failed to initialize mandate checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to set up payment mandate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleSetupMandate} disabled={loading} className="w-full max-w-sm">
      {loading ? 'Redirecting to secure checkout...' : 'Add Payment Method (Setup Mandate)'}
    </Button>
  );
}
