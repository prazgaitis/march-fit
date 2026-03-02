# Fix: Payment succeeds but user not enrolled in challenge

**Date:** 2026-03-01

## Problem
Jarett Cicirello paid for March Fitness 2026 but has no participation record. 5 users stuck in "pending" payment status.

## Root Causes
1. Race condition: Stripe session created before DB records in `createCheckoutSession`
2. Webhook returns 200 OK even when `handlePaymentSuccess` fails — Stripe never retries
3. Silent skip when participation record missing in `handlePaymentSuccess` and `completeVerification`

## Fixes
- [x] Webhook returns 500 on processing failure so Stripe retries
- [x] `handlePaymentSuccess` self-heals: creates missing payment record + participation from Stripe metadata
- [x] `completeVerification` creates participation if missing instead of silently skipping
- [x] Reorder `createCheckoutSession` to create DB records before Stripe session
- [x] Typecheck and lint pass
