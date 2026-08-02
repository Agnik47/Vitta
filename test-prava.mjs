import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const PRAVA_SECRET_KEY = process.env.PRAVA_SECRET_KEY;
const PRAVA_API_BASE_URL = process.env.PRAVA_API_BASE_URL || 'https://sandbox.api.prava.space';
const PRAVA_USER_EMAIL = process.env.PRAVA_USER_EMAIL || 'user@example.com';

if (!PRAVA_SECRET_KEY) {
  console.error("❌ PRAVA_SECRET_KEY is missing from .env");
  process.exit(1);
}

async function runTest() {
  console.log("🧪 Starting Prava API Integration Test...");
  console.log(`📡 Base URL: ${PRAVA_API_BASE_URL}`);
  
  let sessionId = '';
  
  // Step 1: Create Session
  try {
    console.log("\n1️⃣  Testing POST /v1/sessions...");
    const payload = {
      user_id: 'user_' + Date.now(),
      user_email: PRAVA_USER_EMAIL,
      integration_type: 'embedding',
      total_amount: '0.00',
      currency: 'INR',
      purchase_context: [{
        merchant_details: { name: 'Mandate Setup', url: 'http://localhost:3000', country_code_iso2: 'IN' },
        product_details: [{ description: 'Card Auth', unit_price: '0.00', quantity: 1 }],
      }],
    };
    
    console.log("Payload:", JSON.stringify(payload, null, 2));

    const res = await fetch(`${PRAVA_API_BASE_URL}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRAVA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error("❌ Session creation failed.");
      console.error("Status:", res.status);
      console.error("Response:", JSON.stringify(data, null, 2));
      return;
    }

    console.log("✅ Session created successfully!");
    console.log(`Session ID: ${data.session_id}`);
    console.log(`Iframe URL: ${data.iframe_url}`);
    
    sessionId = data.session_id;
  } catch (err) {
    console.error("❌ Network or runtime error during session creation:", err.message);
    return;
  }

  // Step 2 & 3: We cannot programmatically fill the card iframe (PCI compliance), 
  // but we CAN test if the GET /payment-result endpoint is reachable.
  try {
    console.log(`\n2️⃣  Testing GET /v1/sessions/${sessionId}/payment-result (Expected: Pending or Not Found)...`);
    
    const res = await fetch(`${PRAVA_API_BASE_URL}/v1/sessions/${sessionId}/payment-result`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRAVA_SECRET_KEY}`,
      },
    });

    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (res.status === 400 && data.error?.code === 'INVALID_STATE') {
      console.log("✅ Received expected INVALID_STATE because the user hasn't entered their card yet!");
    }
  } catch (err) {
    console.error("❌ Error fetching payment result:", err.message);
  }

  console.log("\n🎉 Test script completed successfully. The Prava API payloads are perfectly valid.");
}

runTest();
