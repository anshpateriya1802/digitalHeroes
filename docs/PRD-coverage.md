# PRD Coverage Matrix

This file maps major PRD sections to implemented components.

## Overview and Objectives

- Public narrative and CTA: `src/app/page.tsx`
- Subscriber experience: `src/app/dashboard/page.tsx`
- Admin controls: `src/app/admin/page.tsx`

## Subscription and Access

- Subscription status endpoint: `src/app/api/subscription/status/route.ts`
- Supabase subscription schema: `supabase/schema.sql`

## Score Management

- Validation and rolling latest 5 logic: `src/lib/score-engine.ts`
- API: `src/app/api/scores/route.ts`

## Draw and Rewards

- Random and algorithmic draw modes: `src/lib/draw-engine.ts`
- Simulation: `src/app/api/draws/simulate/route.ts`
- Publish official draw: `src/app/api/draws/publish/route.ts`

## Prize Pool

- Tier split and rollover: `src/lib/draw-engine.ts`
- Prize pool schema: `supabase/schema.sql`

## Charity

- Charity listing endpoint: `src/app/api/charities/route.ts`
- Preference and contribution schema: `supabase/schema.sql`

## Winner Verification

- Claim submit/review/payout lifecycle endpoint: `src/app/api/winners/route.ts`
- Winner claim schema: `supabase/schema.sql`

## Reporting and Admin Analytics

- Analytics endpoint: `src/app/api/admin/reports/overview/route.ts`
- Admin dashboard summary: `src/app/admin/page.tsx`

## Technical and Scalability Foundation

- Environment template: `.env.example`
- Deployment-ready Next.js setup: `package.json`
- Extensible schema and role model: `supabase/schema.sql`
