import fs from 'node:fs';

const key = process.env.PRAVA_SECRET_KEY || 'sk_test_58a029ba7cf3_MUOKMl8QG7RRpDq7HOGmUm9BqwWWZvYjzx9VJeIfRtI';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  try {
    const r = await fetch('https://sandbox.api.prava.space/v1/mandates?customer_id=vitta_test&standing_only=false', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    console.log(await r.json());
  } catch (err) {
    console.error(err);
  }
}
test();
