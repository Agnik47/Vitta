import fs from 'node:fs';

const key = process.env.PRAVA_SECRET_KEY || 'sk_test_58a029ba7cf3_MUOKMl8QG7RRpDq7HOGmUm9BqwWWZvYjzx9VJeIfRtI';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  try {
    const r = await fetch('https://sandbox.api.prava.space/v1/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'user_123',
        user_email: 'test@example.com',
        integration_type: 'full_checkout',
        total_amount: '20.00',
        currency: 'INR',
        purchase_context: [{ merchant_details: { name: 'Blinkit', url: 'https://blinkit.com', country_code_iso2: 'IN' }, product_details: [{ description: 'Test', unit_price: '20.00', quantity: 1 }] }],
        mandate_setup: { intent: 'mandate_setup', recurring_frequency: 'one_time', merchant_scope: 'listed', max_charges: 1 },
        external_order_ref: 'test', description: 'Test'
      })
    });
    console.log(await r.json());
  } catch (err) {
    console.error(err);
  }
}
test();
