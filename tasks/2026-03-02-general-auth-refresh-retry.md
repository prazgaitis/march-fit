# 2026-03-02 General Auth Refresh + Retry

- [x] Audit auth token lifecycle and expiry failure path
- [x] Add centralized client retry for unauthenticated Convex mutation/action calls
- [x] Route existing `useMutation`/`useAction` call sites through the centralized wrapper
- [x] Standardize backend auth-required mutations to structured unauthenticated errors
- [x] Add/adjust tests for auth-expiry retry/error detection behavior
- [x] Run targeted verification tests and typecheck
