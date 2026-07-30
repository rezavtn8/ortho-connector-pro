# Hardening roadmap

Findings from the July 2026 audit, ordered by risk × effort. What has already been fixed is
listed at the bottom; everything in P0–P2 is still open.

---

## ⚠️ Deployment actions required

These are code changes that need a matching change outside the repo. Until both halves are
done, the feature is off.

1. **Set the `DIGEST_CRON_SECRET` function secret** and send it as an `x-cron-secret` header
   from whatever schedules `send-biweekly-digest`. The function now fails closed, so the
   digest will not send until this is in place:
   ```sh
   openssl rand -hex 32                                    # generate
   supabase secrets set DIGEST_CRON_SECRET=<value>          # store
   ```
   The scheduled invocation must then `POST` with both the `Authorization` bearer header it
   already sends and `x-cron-secret: <value>`.

2. **Confirm the production domain in `index.html`.** `og:image`/`og:url` now point at
   `https://nexoradental.com/og-image.jpg` (previously a Lovable upload bucket). Correct the
   host if that is not the live domain, or social previews will 404.

---

## P0 — fix before more users land

### 1. Migrations cannot rebuild the database

`src/integrations/supabase/types.ts` describes tables that **no migration creates**:
`patient_sources`, `monthly_patients`, `clinics`, `clinic_brand_settings`,
`google_business_tokens`, `google_reviews`, `review_replies`, `review_sync_log`,
`source_tags`, `user_invitations`, `patient_changes_log`, plus the `dashboard_summary` and
`office_metrics` views. `patient_sources` is the single most important table in the product.

So `supabase/migrations/` is not the source of truth — parts of the schema were applied
straight to the live project. Today that means: no local dev database, no staging
environment, no way to review a schema change before it ships, and no rollback path.

**Fix:** `supabase db dump --schema public` against production, commit the result as a
squashed baseline migration, verify `supabase db reset` reproduces it locally, and from then
on only change schema through a migration file.

### 2. Client-side-only auth rate limiting

`useAuth` tracks failed sign-ins in `localStorage` (`auth_rate_limit`, 5 attempts / 15 min).
An attacker just clears storage, opens a private window, or skips the UI and calls the
Supabase auth endpoint directly. There is a `rate_limit_log` table and a `check_rate_limit`
function in the database that this flow never touches.

**Fix:** keep the localStorage lockout as UX, but enforce the real limit server-side against
`rate_limit_log` keyed on email + IP. Treat the client counter as a hint, never a control.

---

## P1 — user-visible quality

### 3. TypeScript strictness is off

`tsconfig.app.json` has `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`,
`noUnusedLocals: false`. `strictNullChecks: false` in particular means the compiler will
never warn about the `undefined` access that becomes a white-screen crash — and this app
reads deeply nested Supabase rows everywhere.

**Fix:** turn on `noUnusedLocals` and `noUnusedParameters` first (cheap), then
`strictNullChecks` directory by directory. Do not flip all of `strict` at once.

### 4. 388 lint warnings

Now visible for the first time (ESLint had never run — see below): ~170 `no-explicit-any`,
~145 unused vars, ~40 `console.*` in shipped code, ~35 `react-hooks/exhaustive-deps`. The
exhaustive-deps ones matter most — each is a potential stale-closure bug. Work the count
down, then flip those rules from `warn` to `error` in `eslint.config.js`.

### 5. No tests at all

Zero test files, no test runner. Given the domain — patient counts, referral attribution,
billing webhooks — the arithmetic being wrong is worse than the UI being ugly.

**Fix:** add Vitest and cover the pure logic first, where the value-per-hour is highest:
`utils/labelLayoutEngine.ts`, `utils/distanceCalculation.ts`, `utils/labelSizing.ts`,
`lib/validationSchemas.ts`, and the patient-count aggregation in `hooks/useDailyPatients.ts`.

---

## P2 — structural

### 6. Oversized components

`OfficeMatchConfirmation.tsx` (1,343 lines), `pages/Offices.tsx` (1,222),
`pages/SourceDetail.tsx` (1,074), `pages/Settings.tsx` (1,046),
`pages/MailingLabels.tsx` (1,020). Each mixes data fetching, business rules and markup, so
nothing in them is reusable or testable. Pull the data logic into hooks and the rules into
`utils/` as you touch them — no need for a big-bang refactor.

### 7. Half-wired multi-tenancy

The database has `clinics`, `clinic_brand_settings`, `user_invitations`, `get_user_clinic_id`,
`get_user_role`, `user_has_clinic_admin_access`, `accept_invitation` — a full clinic/team
model. The frontend is single-user throughout. Decide whether multi-practice teams are on the
roadmap: if yes, finish it deliberately; if no, drop the tables so they stop implying a
security model that nothing enforces.

### 8. Unused PIN infrastructure

`encrypt_pin_code`, `verify_pin_code`, `verify_user_pin_code`, `update_user_pin_code` exist
in the database with no caller. Either build the feature or remove the functions — dormant
auth code is a liability.

### 9. Orphaned features

Written, complete enough to compile, imported by nothing:

| File | Lines |
| --- | --- |
| `components/WelcomeBooklet.tsx` (+ `BookletEditor`, `BookletPreview`) | ~1,374 |
| `components/OnboardingWizard.tsx` (+ `ClinicAddressSearch`) | ~530 |
| `components/PricingSection.tsx` | ~200 |

Left in place because they look like intended features rather than cruft. **Decide per
feature: wire it up or delete it.** An onboarding wizard and a pricing section are exactly
what a solo-founder product needs, so these are probably "wire up".

### 10. CORS is `*` on every edge function

Every function sends `Access-Control-Allow-Origin: *`. Auth is enforced per-function so this
is not an open door, but it does let any site drive the API with a stolen token. Restrict to
your own origins once the domain list is settled.

---

## Fixed

### Hardening

- **`send-biweekly-digest` was an open email cannon.** `verify_jwt = false` with no auth
  check of its own, running on the service-role key, reading every row of `user_profiles`
  and emailing each one. Anyone with the URL could `POST` it in a loop and mail the whole
  user base repeatedly. Now requires `x-cron-secret` matched timing-safely against
  `DIGEST_CRON_SECRET`, rejects non-`POST`, and fails closed when the secret is unset.
  **Needs the deployment action above to start sending again.**

- **`useAuth` was a hook, so there were 28 copies of the auth machine.** Every call site
  mounted its own `onAuthStateChange` subscription, its own `getSession()` call, its own
  idle-timeout timers, and its own listeners on eight document-level events. Consequences,
  all of them live: dozens of redundant subscriptions per page load; N competing timers
  where whichever fired first called `signOut()`, making idle logout nondeterministic and
  able to sign users out early; and a `SessionTimeoutWarning` modal driven by a *different*
  copy than the one doing the signing out, so the warning and the logout were uncoordinated.

  Now split three ways, each file lint-clean: `contexts/authContext.ts` (context + type),
  `contexts/AuthProvider.tsx` (the one subscription, the one timer pair, the one listener
  set), `hooks/useAuth.ts` (a `useContext` read that throws if used outside the provider).
  The returned shape is unchanged, so none of the 28 call sites needed editing.

- **Route code splitting was decorative.** `SuspenseWrapper` wrapped 25 pages that
  `pages/Index.tsx` imported *statically*, so nothing was ever lazy and every user
  downloaded Mapbox, Leaflet, `xlsx`, `jspdf` and Recharts on first paint. Routes are now
  real `React.lazy` imports driven off a route table, and `@googlemaps/js-api-loader` is
  dynamically imported in all three places rather than two dynamic and one static.

  | | Before | After |
  | --- | --- | --- |
  | Initial JS (gzip) | 1,280 kB | **200 kB** |
  | Initial JS + CSS (gzip) | 1,304 kB | **224 kB** |
  | Largest eager chunk | 4,502 kB | 367 kB |

  Note on `manualChunks`: only `vendor-react` and `vendor-data` are pinned, and via the
  **function** form. The object form makes Vite synthesise a module that imports every
  listed package from the entry — which put maps/charts/PDF straight back into the initial
  download. That mistake was made and measured before landing on the current config.

### Lovable cleanup

- Lovable boilerplate README → real project docs.
- `lovable`, `lovable-tagger`, `tagger` dependencies removed (36 packages).
- `.lovable/plan.md`, stock Vite `App.css`, `placeholder.svg` deleted.
- `og:image` moved off the `gpt-engineer-file-uploads` bucket to a self-hosted asset;
  `flavicon.ico` → `favicon.ico`.
- **ESLint had never run.** `eslint.config.js` imported `typescript-eslint`, which was not
  installed, and `npm run lint` passed `--ext`, which flat config rejects. Upgraded to
  ESLint 9 + typescript-eslint 8, fixed all 16 resulting errors, added `npm run typecheck`.
- **Reduced-motion accessibility was silently broken.** `src/index.css` had `\\:` where it
  needed `\:`, and Tailwind mangled the block anyway because it sat inside `@layer base`.
  Moved outside the layer; the `prefers-reduced-motion` override now actually applies.
- `.env` was committed to git — untracked and ignored. Only public Supabase values were in
  it (anon key, project URL, both browser-safe), so **no rotation is needed**.
- Hardcoded Supabase URL/key in `client.ts` → `import.meta.env`, with a typed
  `ImportMetaEnv` and a startup error when unset. `.env.example` added.
- Three `*Resilient` page shims collapsed into the canonical page names.
- 16 dead files deleted; duplicate `bun.lock`/`bun.lockb` removed (npm is the one manager).
