# Zona de pasos store

A production-oriented Next.js App Router scaffold for a Colombia-only sneaker storefront. Technical artifacts are written in English; the public shell uses Spanish customer-facing copy.

## Stack

- Next.js 16 App Router with React and TypeScript
- ESLint flat config
- Tailwind CSS 4 through PostCSS
- Vitest, jsdom, and Testing Library

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## T1 scope

The first public shell establishes:

- The confirmed store name, Colombia-only market, adult men and women audience, and Colombian-peso language.
- Accessible design tokens, focus states, skip navigation, semantic landmarks, and responsive mobile-first layout primitives.
- A campaign-led placeholder homepage with practical discovery sections, sizing/shipping/payment expectations, and a visible WhatsApp support route.
- A deliberately data-free collection state so catalog, inventory, authentication, cart, checkout, Supabase, and Cloudinary work can be added in later tasks.

The typographic `ZP` mark is a temporary shell treatment. Final logo design, returns policy, customer accounts, automated Nequi verification, and carrier API integrations are deferred by the product scope.

## T2 authentication and onboarding

Copy the variable names from `config/env.example` into `.env.local`, then provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a 64-character hexadecimal `SETUP_SECRET` generated with `openssl rand -hex 32`. The application validates only this format; cryptographic randomness is the operator's responsibility and cannot be proven by the application. Weak deployment secrets are rejected with HTTP 503. Only the first two values may be public; the service-role key and setup secret are server-only.

Apply `supabase/migrations/202604020001_auth_onboarding.sql` with the Supabase CLI or SQL editor. Then open `/setup` once to create the first developer superadmin. The database completion marker is durable and remains completed even if that user is later deleted. Superadmins create expiring, single-use administrator invitations from `/admin`; invitation tokens are hashed at rest and shared only in URL fragments, never query strings.

The App Router session is refreshed by `proxy.ts`. Every protected route re-reads the authenticated user and profile, rejects suspended accounts, and enforces its required role server-side. The service-role client lives only in `lib/supabase/admin.ts` and is never imported by client components.

## T3 catalog, settings, and inventory foundation

Migration `supabase/migrations/202604020002_catalog_inventory.sql` covers the bounded data/domain slice for S2-S3 and S9-S10: administrator-managed brands, adult sneaker products and variants, Cloudinary public asset metadata, admin-only commerce settings with a safe storefront projection, and audited atomic inventory adjustments. `lib/catalog/domain.ts` contains pure COP validation, stock classification, display-mode rendering, and immutable adjustment helpers. Admin UI, Cloudinary upload code, and service credentials remain deferred.

After applying the T2 migration, apply this migration with the Supabase CLI or SQL editor.

After adding the Supabase dependencies, run:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/          App Router pages, protected admin/auth routes, and global styles
components/   Reusable public-shell and admin components
lib/          Store constants, auth policy/services, and Supabase server clients
supabase/     RLS migration for administrator onboarding and audit events
tests/        Observable shell, auth-domain, and security invariant tests
```
