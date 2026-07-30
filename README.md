# Nexora

Dental practice growth platform. Track referral sources, measure where patients actually
come from, run outreach campaigns to referring offices, and watch competitors — all in one
place.

## Stack

| Layer    | Choice                                             |
| -------- | -------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui    |
| Data     | TanStack Query                                     |
| Backend  | Supabase (Postgres + Auth + RLS + Edge Functions)  |
| Maps     | Google Maps / Places, Mapbox, Leaflet              |
| Email    | Resend                                             |
| Billing  | Stripe                                             |

## Getting started

Requires Node.js 20+ and npm.

```sh
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:8080
```

## Environment

All frontend config comes from `.env` (Vite only exposes `VITE_`-prefixed vars to the
browser). See `.env.example` for the full list. Never put a service-role key or any
third-party API secret in a `VITE_` variable — those ship to the browser. Server-side
secrets live in Supabase Edge Function secrets.

## Scripts

| Command             | Does                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Dev server on port 8080                     |
| `npm run build`     | Typecheck, then production build to `dist/` |
| `npm run preview`   | Serve the production build locally          |
| `npm run typecheck` | TypeScript only, no emit                    |
| `npm run lint`      | ESLint over `src/`                          |

## Layout

```
src/
  pages/               one component per route (see pages/Index.tsx for the route table)
  components/          feature components
  components/ui/       shadcn/ui primitives — generated, avoid hand-editing
  hooks/               data-fetching and stateful logic
  lib/                 cross-cutting helpers (sanitize, validation, date sync)
  utils/               pure domain helpers (label layout, distance, PDF)
  integrations/supabase/
                       client + generated database types
supabase/
  functions/           Deno edge functions
  migrations/          SQL migrations
```

## Architecture notes

- **Routing** is nested: `App.tsx` mounts a single catch-all route into `pages/Index.tsx`,
  which gates on auth and holds the real route table.
- **Error handling** is layered: `ProductionErrorBoundary` at the root, `ErrorBoundary`
  per section, with errors logged to the `error_logs` table. See
  [docs/ERROR_BOUNDARY_GUIDE.md](docs/ERROR_BOUNDARY_GUIDE.md).
- **Every table has RLS enabled**; the client only ever uses the anon key and relies on
  RLS for tenant isolation.
- **Edge functions run with `verify_jwt = false`** and authenticate requests themselves
  (see `supabase/config.toml`). Any new function must do its own auth check.

## Known gaps

See [docs/ROADMAP.md](docs/ROADMAP.md) for the current hardening backlog, and
[docs/LOVABLE-BRIEF.md](docs/LOVABLE-BRIEF.md) for paste-ready prompts to work through it
in Lovable — including the guardrails that stop Lovable from reverting decisions made here.
