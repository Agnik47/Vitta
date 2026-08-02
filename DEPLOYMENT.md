# Vercel Deployment Guide

## One-time Setup on Vercel Dashboard

1. **Import GitHub repo** (https://github.com/Agnik47/Vitta)
2. **Set Environment Variables** in Vercel Project Settings → Environment Variables:

```
PRAVA_SECRET_KEY=sk_test_58a029ba7cf3_MUOKMl8QG7RRpDq7HOGmUm9BqwWWZvYjzx9VJeIfRtI
NEXT_PUBLIC_PRAVA_PUBLIC_KEY=pk_test_Klb9nvLixLsB4LKhK2h9Tp76McMHpl3TbPOUS1k28os
PRAVA_USER_EMAIL=tanuku.saikarthik2@gmail.com
PRAVA_API_BASE_URL=https://sandbox.api.prava.space
MANDATE_GATE_DATA_DIR=../
```

3. **Root Directory**: Set to `/` (or leave default)
4. **Deploy** — Vercel will auto-detect Next.js in `dashboard/` and use the build config in `vercel.json`

## What happens on each deploy:
- ✅ CLI (`src/`) is built → `dist/`
- ✅ Dashboard (Next.js) is built
- ✅ API routes can spawn `gate` CLI
- ⚠️ File state (`mandates/`, `receipts/`) is ephemeral — fine for a single test run

## Testing flow:
1. Visit `https://your-vercel-deployment.vercel.app/mandate`
2. Create mandate → funds Prava session
3. Complete Prava checkout in browser
4. Confirm funding → balance should appear
5. Go to `/shop` → add items → purchase (executes `gate run`)

All within one session ✓
