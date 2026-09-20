# Vercel Deployment Guide

## One-time Setup on Vercel Dashboard

1. **Import GitHub repo** (https://github.com/Agnik47/Vitta)
2. **Set Environment Variables** in Vercel Project Settings → Environment Variables — **test-mode Razorpay keys only** (a `rzp_live_…` key is refused by design):

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<your test key secret>
RAZORPAY_WEBHOOK_SECRET=<optional: the secret from Razorpay's webhook settings>
RAZORPAY_CHECKOUT_BASE_URL=https://your-vercel-deployment.vercel.app
MANDATE_GATE_DATA_DIR=../
```

Never paste real keys into this file or commit them; set them in Vercel (and rotate any key that has ever been committed).

3. **Root Directory**: Set to `/` (or leave default)
4. **Deploy** — Vercel will auto-detect Next.js in `dashboard/` and use the build config in `vercel.json`
5. *(Optional)* In Razorpay's dashboard (Test Mode → Webhooks) add `https://your-vercel-deployment.vercel.app/api/razorpay/webhook` with the events `order.paid`, `payment.captured` and `payment.authorized`, using the same secret as `RAZORPAY_WEBHOOK_SECRET`. Without it, funding is confirmed by the "I've paid" button / the Checkout callback instead.

## What happens on each deploy:
- ✅ CLI (`src/`) is built → `dist/`
- ✅ Dashboard (Next.js) is built
- ✅ API routes can spawn `gate` CLI
- ⚠️ File state (`mandates/`, `receipts/`, `razorpay-ledger.jsonl`) is ephemeral — fine for a single test run. The reserve's spent amount is also recorded on the Razorpay order itself, so a cold start cannot give spent money back.

## Testing flow:
1. Visit `https://your-vercel-deployment.vercel.app/mandate`
2. Create a mandate → **Create test order & pay** (creates a Razorpay test order and opens Checkout)
3. Pay with a test card — `4100 2800 0000 1007`, any future expiry, any CVV; on the bank page any 4–10 digit OTP succeeds
4. The balance appears once Razorpay reports the payment captured
5. Go to `/shop` → add items → purchase (executes `gate run`)

All within one session ✓
