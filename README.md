# Drive for Good

Drive for Good is a Next.js + Supabase app for subscription-based golf draws with charity contributions, winner claims, and admin moderation.

## Features

- Subscriber signup/login and dashboard
- Stableford score tracking (latest 5 scores retained)
- Draw simulation and monthly publish flow
- Unique draw IDs and draw history
- Claim submission with proof upload
- Admin claim review (approve/reject/mark paid)
- Admin request-and-approval flow for creating additional admins
- Razorpay order/verify/webhook endpoints scaffolded

## Tech Stack

- Next.js 16.2.1 (App Router, Turbopack in dev)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase (database, auth admin API, storage)
- Razorpay (payment integration endpoints)

## Project Structure

- App routes and APIs: `src/app`
- Shared server/domain logic: `src/lib`
- Supabase schema: `supabase/schema.sql`
- Product docs: `docs/`

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Copy env file

```bash
cp .env.example .env.local
```

3. Fill required values in `.env.local`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_MONTHLY=
RAZORPAY_PLAN_YEARLY=

# Email provider
EMAIL_FROM=noreply@driveforgood.app
RESEND_API_KEY=
```

4. Apply database schema

- Open Supabase SQL editor
- Run `supabase/schema.sql`

5. Start app

```bash
npm run dev
```

6. Open

- `http://localhost:3000`

## Core User Flows

### Subscriber Flow

1. Sign up from `/auth/sign-up`
2. Manage subscription, scores, charity preferences in `/dashboard`
3. Run practice draw and view draw reference IDs
4. Submit claim with proof for eligible draws (3+ matches)

### Draw IDs and History

- Latest published draw ID is shown in dashboard cards
- Previous draw IDs are shown in a scrollable list (latest 10)
- Practice draw reference IDs are stored client-side as a rolling last-10 list

### Claim Flow

- Claim submission endpoint accepts `drawEntryId` or `drawId`
- Eligibility is auto-detected using `match_count >= 3`
- Duplicate claims for same draw entry are prevented
- Claim statuses: `pending -> approved/rejected -> paid`

## Admin Access and Approval

### First Admin Bootstrap / Login

- Use `/control-room`
- If no admin exists, bootstrap first admin credentials
- If admin exists, control-room works as admin login

### Creating Additional Admins

Additional admins are created through approval workflow:

1. Existing admin submits a create-admin request
2. Another existing admin must approve or reject it
3. On approval, admin account is created and temporary password is returned

### Admin Dashboard

- Route: `/admin`
- Modules include:
	- Draw and operational controls
	- User management
	- Draw claims review and payout updates
	- Charities
	- Subscriptions
	- Prize pools

## Storage Notes

- Claim proof uploads use Supabase storage bucket `winner-proofs`
- If bucket is missing, API attempts automatic bucket creation and upload retry

## API Overview

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Subscriber

- `GET/POST /api/scores`
- `POST /api/subscription`
- `GET /api/subscription/status`
- `PATCH /api/charity-preference`
- `POST /api/winners`

### Draws

- `GET /api/draws/current`
- `POST /api/draws/practice`
- `POST /api/draws/simulate`
- `POST /api/draws/publish`

### Admin

- `GET/POST /api/admin/access`
- `GET/POST/PATCH/PUT/DELETE /api/admin/users`
- `GET/PATCH /api/admin/claims`
- `GET /api/admin/reports/overview`
- `GET/PATCH /api/admin/subscriptions`
- `GET/POST /api/admin/draws`

### Payments

- `POST /api/razorpay/order`
- `POST /api/razorpay/verify`
- `POST /api/razorpay/webhook`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Troubleshooting

### Hydration errors in dashboard

- Avoid browser-only state initialization during first render
- Use deterministic server-rendered strings for timestamps

### Bucket not found on claim upload

- Ensure Supabase storage is enabled
- API includes auto-create + retry for `winner-proofs`

## Security and Production Notes

- Rotate service keys and secrets before production
- Restrict storage bucket and RLS policies as needed
- Do not commit `.env`, `.env.local`, or real credentials

