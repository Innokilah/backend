# Erhanive Backend (Node + Express + MySQL)

## Setup
1. Copy `.env.example` to `.env` and fill in your MySQL credentials.
2. Install deps:
   ```bash
   npm install
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

## PayChangu setup
1. Keep `PAYCHANGU_SECRET_KEY` only in `backend/.env`.
2. Use `PAYCHANGU_MOCK_MODE=true` while the key is empty or while you are testing without real checkout.
3. To process real payments, set:
   - `PAYCHANGU_SECRET_KEY` to your real secret key
   - `PAYCHANGU_CALLBACK_URL` to a URL PayChangu can reach
   - `PAYCHANGU_RETURN_URL` to a URL the mobile checkout can open after payment
4. For local device testing, `localhost` usually will not work inside the phone app. Use your computer's LAN IP for app-to-backend calls, and use a public HTTPS tunnel/domain for PayChangu callbacks if webhooks are needed.

Example:

```env
PAYCHANGU_SECRET_KEY=sec-live-lo4kweyzfEYyhBDRhsimbhamK10LNCq7
PAYCHANGU_WEBHOOK_SECRET=sec-live-lo4kweyzfEYyhBDRhsimbhamK10LNCq7
PAYCHANGU_CALLBACK_URL=https://your-public-api-domain.com/api/payments/paychangu/callback
PAYCHANGU_RETURN_URL=https://your-public-api-domain.com/api/payments/paychangu/return
PAYCHANGU_MOCK_MODE=false
```

## Endpoints (stub)
- `GET /api/health`
- `GET /api/listings`
- `GET /api/listings/:id`
- `POST /api/owner/listings`
- `GET /api/owner/listings`
- `PATCH /api/owner/listings/:id`
- `GET /api/admin/listings`
- `PATCH /api/admin/listings/:id`

Next step: define DB schema and implement real queries.

