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
- A campaign-led public homepage with practical discovery sections, live published-product highlights, sizing/shipping/payment expectations, and a configurable WhatsApp support route.
- A responsive public catalog with GET filters for audience, brand, size, color, COP price boundaries, and sorting.

The typographic `ZP` mark is a temporary shell treatment. Final logo design, returns policy, customer accounts, automated Nequi verification, and carrier API integrations are deferred by the product scope.

## T2 authentication and onboarding

Copy the variable names from `config/env.example` into `.env.local`, then provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a 64-character hexadecimal `SETUP_SECRET` generated with `openssl rand -hex 32`. The application validates only this format; cryptographic randomness is the operator's responsibility and cannot be proven by the application. Weak deployment secrets are rejected with HTTP 503. Only the first two values may be public; the service-role key and setup secret are server-only. Cloudinary uses authenticated server-side uploads with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; all three values are server-only, and the API secret must never use a `NEXT_PUBLIC_` name.

Apply `supabase/migrations/202604020001_auth_onboarding.sql` with the Supabase CLI or SQL editor. Then open `/setup` once to create the first developer superadmin. The database completion marker is durable and remains completed even if that user is later deleted. Superadmins create expiring, single-use administrator invitations from `/admin`; invitation tokens are hashed at rest and shared only in URL fragments, never query strings.

The App Router session is refreshed by `proxy.ts`. Every protected route re-reads the authenticated user and profile, rejects suspended accounts, and enforces its required role server-side. The service-role client lives only in `lib/supabase/admin.ts` and is never imported by client components.

## T3 catalog, settings, and inventory foundation

Migration `supabase/migrations/202604020002_catalog_inventory.sql` covers the bounded data/domain slice for S2-S3 and S9-S10: administrator-managed brands, adult sneaker products and variants, Cloudinary public asset metadata, admin-only commerce settings with a safe storefront projection, and audited atomic inventory adjustments. `lib/catalog/domain.ts` contains pure COP validation, stock classification, display-mode rendering, and immutable adjustment helpers.

The secured image infrastructure now provides authenticated Node.js upload and deletion routes at `/api/admin/product-images`. Uploads accept JPEG, PNG, WebP, and AVIF files up to 5 MiB, normalize alt text, and remain confined to the `zona-de-pasos/products` prefix. The Cloudinary API secret is read only by `server-only` modules; the browser never receives Cloudinary credentials or uses an unsigned preset. This slice intentionally does not perform magic-byte validation; Cloudinary's decoder behavior remains an external proof gap. Product persistence, catalog admin UI, and the rest of the T3 workflow remain deferred.

After applying the T2 migration, apply this migration with the Supabase CLI or SQL editor. The additive workflow migration `supabase/migrations/202604020003_catalog_admin_workflows.sql` adds the authenticated atomic product-creation RPC; it does not rewrite migrations 001/002.

The server-only admin workflow routes are `/api/admin/brands`, `/api/admin/products`, `/api/admin/products/:id`, `/api/admin/settings`, and `/api/admin/inventory`. They require an active administrator before parsing input, keep Nequi details out of public projections, and use injectable catalog adapters for tests. Product creation retains a previously uploaded Cloudinary asset when persistence is ambiguous so an operator can retry or remove it manually.

This bounded slice covers T3 S2-S3 and S9-S10. Admin catalog/settings pages and forms remain deferred.

## T4 public catalog foundation

The first bounded T4 slice adds a server-only anonymous Supabase reader in `lib/supabase/public.ts` and a safe public catalog adapter in `lib/storefront/catalog.ts`. It queries published products, `storefront_product_variants`, and the narrow `storefront_settings` projection, then merges rows without returning stock quantities, Nequi details, dispatch addresses, drafts, or admin lifecycle data. Missing environment, database errors, empty catalogs, malformed rows, and partial variant/image data have explicit result states or warnings.

Pure catalog filters and stable sorting live in `lib/storefront/filters.ts`. WhatsApp phone normalization and Spanish support links live in `lib/storefront/support.ts`; reusable Spanish product, price, stock, and audience primitives live in `components/storefront/`. Cloudinary images are accepted only over HTTPS from Cloudinary delivery hosts and configured in `next.config.ts`. The public routes are `/`, `/catalog`, and `/products/:slug`; they use dynamic rendering and async Next.js 16 route props so builds do not require live Supabase credentials. Drafts and internal inventory/payment fields remain outside the public projection. Cart selection, checkout, order creation, and payment behavior remain deferred to T5.

This bounded slice covers T4 S1-S2, S9-S10 public stock behavior, S13, and S15.

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
app/          App Router pages, public catalog/product routes, protected admin/auth routes, and global styles
components/   Reusable public-shell and admin components
lib/          Store constants, auth policy/services, storefront query/data helpers, and Supabase server clients
supabase/     RLS migration for administrator onboarding and audit events
tests/        Observable shell, auth-domain, and security invariant tests
```
