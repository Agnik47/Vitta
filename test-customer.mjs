import fs from 'node:fs';

const key = process.env.PRAVA_SECRET_KEY || 'sk_test_58a029ba7cf3_MUOKMl8QG7RRpDq7HOGmUm9BqwWWZvYjzx9VJeIfRtI';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  try {
    const userId = 'user_test_' + Date.now();
    console.log("Creating session for", userId);
    
    // Create session
    let r = await fetch('https://sandbox.api.prava.space/v1/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        user_email: 'test@example.com',
        integration_type: 'full_checkout',
        total_amount: '20.00',
        currency: 'INR',
        purchase_context: [{ merchant_details: { name: 'Blinkit', url: 'https://blinkit.com', country_code_iso2: 'IN' }, product_details: [{ description: 'Test', unit_price: '20.00', quantity: 1 }] }],
        mandate_setup: { intent: 'mandate_setup', recurring_frequency: 'one_time', merchant_scope: 'listed', max_charges: 1 },
        external_order_ref: 'test', description: 'Test'
      })
    });
    const session = await r.json();
    console.log("Session created:", session.session_id);
    
    // Check if customer exists immediately
    r = await fetch('https://sandbox.api.prava.space/v1/mandates?customer_id=' + userId + '&standing_only=true', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const mandates = await r.json();
    console.log("Mandates:", mandates);
    
  } catch (err) {
    console.error(err);
  }
}
test();
