# Vendor app: Codex instructions

## Context

This independent Git repository is the Lucky BH / Alfarah Expo app for vendor administrators, dealers and agents. Its directory name contains two spaces after `FE`. The shared API is `../Backend/`; the separate super-admin app is `../FE top-admin/`. Read `../AGENTS.md` when available for the system map.

Stack: Expo 53.0.20, expo-router 5, React Native 0.79.5, React 19, TypeScript, NativeWind/Tailwind, Zustand and React Query. `@/*` maps to the repository root. Use existing patterns and package-lock.json; do not combine dependency management with the other frontend.

## Code map and conventions

- `app/_layout.tsx`: root providers/stack; `app/(tabs)/_layout.tsx`: role/feature-dependent tabs. Follow existing navigation gating and enforce authorization on the backend as well.
- `app/index.tsx`, `components/calculator.tsx`, `hooks/use-calculator.ts`, `app/login.tsx`, `store/auth.ts`: calculator and login/session flows.
- `app/book.tsx`, booking detail/deletion screens, `hooks/use-delete-window.ts`: booking lifecycle and deletion policy.
- `app/(tabs)/dealer.tsx`, `agent.tsx`, `staff.tsx` and corresponding hooks: hierarchy management. `app/(tabs)/payement.tsx` is intentionally the existing filename; do not rename routes incidentally.
- Result, winnings, reports, payments, limit-count and transfer-log screens implement operational workflows. `components/draw-result-form.tsx`, `prize-config.tsx`, `utils/amount.ts`, `utils/date.ts`, `utils/pdf.tsx` contain shared behavior.
- `utils/axios.ts`: authenticated API client, timing/file logging, 204 and native 2xx recovery, auth/inactive redirects and restricted transport retries. Use it for authenticated data calls; existing auth/bootstrap uses direct fetch.
- `providers/react-query-provider.tsx`: server-data cache; `store/auth.ts`: session state. Preserve cache clearing on account/session changes so one user's cached data cannot appear for another.
- Styling uses `global.css` and `tailwind.config.js`. Check `app.json`, `eas.json` and native Android configuration for native/build changes; these are mobile apps, so web checks alone do not validate native modules.

## Contracts to preserve

The store uses `ADMIN | DEALER | AGENT`; backend administrators use `ADMINISTRATOR`. Inspect normalization in the calculator hook and session setters. Features use `hasFeature(codename)` and `vendor_features`, with superuser bypass. Backend querysets provide vendor scope; only send vendor filters for endpoints that explicitly support them.

Calculator auth currently calls `/dealer/login-v2/` or `/agent/login-v2/`, and `/user/verify-calculate-str/` for the administrator path. The store retains `preLoginToken` and `setSessionFromV2`. Do not delete these as obsolete based on old CLAUDE.md or the sibling multi-vendor guide: the current backend implements verification, PreLoginToken and `get-initial-user-creds/?type=new`. Trace client and backend together for auth work.

Preserve booking idempotency and number formatting, BOX totals, hierarchical prizes/commissions, draw cutoffs and deletion windows. The Axios retry policy allows only safe GET/HEAD/OPTIONS transport retries and excludes timeouts. Do not retry POST/PUT/PATCH automatically: the first request may already have changed the server.

## Commands and validation

Run here:

```text
npm ci
npm start
npm run android
npm run web
npm run lint
npx tsc --noEmit
```

`npm run ios` requires macOS/native iOS tooling. Android uses `expo run:android` and requires Android SDK/JDK/device or emulator. There is **no test script** in this app's package.json; do not claim `npm test` is available. Use lint/type checks for code changes and focused manual checks of affected roles, features and native workflows. Record existing failures separately. Do not run `reset-project` during maintenance: it replaces application structure.

`utils/config.ts` currently points to the live `https://alfarah.in` API. Select a development API before manual network-backed tests; do not submit live bookings/payments as checks. Keep local test URL changes out of unrelated commits. Do not expose tokens, credentials or signing files, and avoid generated dependencies/native build output. Update this guide when contracts or commands change.
