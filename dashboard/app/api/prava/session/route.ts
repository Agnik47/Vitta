import { NextRequest, NextResponse } from 'next/server';
import dotenv from 'dotenv';
import path from 'path';

// Find the .env file whether we are in dashboard/ or root
const envPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '../.env');
dotenv.config({ path: envPath });
dotenv.config({ path: parentEnvPath });

export async function POST(req: NextRequest) {
  try {
    const { email, amount } = await req.json();

    const userId = 'user_' + Date.now();
    const response = await fetch(`${process.env.PRAVA_API_BASE_URL || 'https://api.prava.space'}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRAVA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        user_email: process.env.PRAVA_USER_EMAIL || email || 'user@example.com',
        integration_type: 'full_checkout',
        total_amount: amount ? Number(amount).toFixed(2) : '0.00',
        currency: 'INR',
        purchase_context: [{
          merchant_details: { name: 'Mandate Setup', url: 'https://example.com', country_code_iso2: 'IN' },
          product_details: [{ description: 'Authorized Spending Cap', unit_price: amount ? Number(amount).toFixed(2) : '0.00', quantity: 1 }],
        }],
        mandate_setup: { intent: 'mandate_setup', recurring_frequency: 'one_time', merchant_scope: 'listed', max_charges: 1 },
        external_order_ref: 'vitta_test_' + Date.now(),
        description: 'Vitta spending mandate',
      }),
    });

    const session = await response.json();

    if (!response.ok) {
      let errorMessage = session.error?.message || session.message || 'Failed to create session';
      if (session.error?.details) {
        errorMessage += ' - Details: ' + JSON.stringify(session.error.details);
      } else if (session.details) {
        errorMessage += ' - Details: ' + JSON.stringify(session.details);
      }
      throw new Error(errorMessage);
    }

    const pubKey = process.env.PRAVA_PUBLIC_KEY;
    if (!pubKey) {
      console.error("PRAVA_PUBLIC_KEY is not defined in process.env");
    }

    return NextResponse.json({
      ...session,
      user_id: userId,
      publishable_key: pubKey || 'pk_test_Klb9nvLixLsB4LKhK2h9Tp76McMHpl3TbPOUS1k28os', // Fallback to the one from .env if env is broken
    });
  } catch (error: any) {
    console.error('Error creating Prava embedding session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
