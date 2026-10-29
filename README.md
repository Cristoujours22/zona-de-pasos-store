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

Copy the variable names from `config/env.example` into `.env.local`, then provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and separate 64-character hexadecimal `SETUP_SECRET` and `ORDER_TRACKING_SECRET` values generated with `openssl rand -hex 32`. The application validates only this format; cryptographic randomness is the operator's responsibility and cannot be proven by the application. Weak deployment secrets are rejected with HTTP 503. Only the first two values may be public; the service-role key and setup secret are server-only. Cloudinary uses authenticated server-side uploads with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; all three values are server-only, and the API secret must never use a `NEXT_PUBLIC_` name.

Apply `supabase/migrations/202604020001_auth_onboarding.sql` with the Supabase CLI or SQL editor. Then open `/setup` once to create the first developer superadmin. The database completion marker is durable and remains completed even if that user is later deleted. Superadmins create expiring, single-use administrator invitations from `/admin`; invitation tokens are hashed at rest and shared only in URL fragments, never query strings.

The App Router session is refreshed by `proxy.ts`. Every protected route re-reads the authenticated user and profile, rejects suspended accounts, and enforces its required role server-side. The service-role client lives only in `lib/supabase/admin.ts` and is never imported by client components.

Administrators who forget their password can use `/auth/forgot-password`. Recovery requests always return the same accepted response so account existence is not disclosed. Supabase redirects the one-time PKCE code only to the allowlisted `/auth/callback`, which exchanges it for a recovery session before `/auth/update-password` accepts a 12–128 character password. The update route revalidates an active administrator profile and requests global session invalidation after the password is committed. Its response distinguishes confirmed invalidation from a partial outcome, so the UI never reports a failed password change when only global sign-out failed. Expired, reused, missing, suspended, or unauthorized recovery sessions cannot change a password. Administrative authentication pages are marked `noindex` and `noarchive`.

## T3 catalog, settings, and inventory foundation

Migration `supabase/migrations/202604020002_catalog_inventory.sql` covers the bounded data/domain slice for S2-S3 and S9-S10: administrator-managed brands, adult sneaker products and variants, Cloudinary public asset metadata, admin-only commerce settings with a safe storefront projection, and audited atomic inventory adjustments. `lib/catalog/domain.ts` contains pure COP validation, stock classification, display-mode rendering, and immutable adjustment helpers.

The secured image infrastructure now provides authenticated Node.js upload and deletion routes at `/api/admin/product-images`. Uploads accept JPEG, PNG, WebP, and AVIF files up to 5 MiB, normalize alt text, and remain confined to the `zona-de-pasos/products` prefix. The Cloudinary API secret is read only by `server-only` modules; the browser never receives Cloudinary credentials or uses an unsigned preset. This implementation intentionally does not perform local magic-byte validation; Cloudinary's decoder behavior remains an external proof gap. Product persistence and catalog administration are provided by the protected workflows described below.

After applying the T2 migration, apply this migration with the Supabase CLI or SQL editor. The additive workflow migration `supabase/migrations/202604020003_catalog_admin_workflows.sql` adds the authenticated atomic product-creation RPC; it does not rewrite migrations 001/002.

The server-only admin workflow routes are `/api/admin/brands`, `/api/admin/products`, `/api/admin/products/:id`, `/api/admin/settings`, and `/api/admin/inventory`. They require an active administrator before parsing input, keep Nequi details out of public projections, and use injectable catalog adapters for tests. Product creation retains a previously uploaded Cloudinary asset when persistence is ambiguous so an operator can retry or remove it manually.

This bounded slice covers T3 S2-S3 and S9-S10, including the protected catalog, inventory, and settings pages.

## T4 public catalog foundation

The first bounded T4 slice adds a server-only anonymous Supabase reader in `lib/supabase/public.ts` and a safe public catalog adapter in `lib/storefront/catalog.ts`. It queries published products, `storefront_product_variants`, and the narrow `storefront_settings` projection, then merges rows without returning stock quantities, Nequi details, dispatch addresses, drafts, or admin lifecycle data. Missing environment, database errors, empty catalogs, malformed rows, and partial variant/image data have explicit result states or warnings.

Pure catalog filters and stable sorting live in `lib/storefront/filters.ts`. WhatsApp phone normalization and Spanish support links live in `lib/storefront/support.ts`; reusable Spanish product, price, stock, and audience primitives live in `components/storefront/`. Cloudinary images are accepted only over HTTPS from Cloudinary delivery hosts and configured in `next.config.ts`. The public routes are `/`, `/catalog`, and `/products/:slug`; they use dynamic rendering and async Next.js 16 route props so builds do not require live Supabase credentials. Drafts and internal inventory/payment fields remain outside the public projection. Cart selection, checkout, and order creation are implemented in the T5 sections below.

This bounded slice covers T4 S1-S2, S9-S10 public stock behavior, S13, and S15.

## T5 cart slice

The root layout now mounts a client-only `CartProvider` for a versioned, guest-only localStorage cart. Stored items contain authoritative product/variant IDs and quantity plus non-sensitive display snapshots; display prices are informational only, and buyer/payment data and exact stock never enter persistence. Malformed or unknown-version data is discarded, storage failures are tolerated, and browser `storage` events synchronize tabs.

Product detail now selects one available variant, keeps quantities between 1 and 99, merges the same variant, and disables unavailable variants using the public availability flag without inferring stock. The public header exposes a cart count and `/cart` reviews display snapshots, an informational COP subtotal, quantity/removal controls, a backend-authority warning, and a link to `/checkout`.

The Colombia-only guest checkout collects buyer and delivery data with explicit processing consent, sends only variant IDs and quantities as cart authority, and preserves one UUID v4 idempotency key per cart identity in tab-local session storage across ambiguous retries. Successful responses are validated before the cart is cleared: only a trusted HTTPS `wa.me` handoff is accepted, WhatsApp opens only after an explicit customer action, and the rendered receipt excludes document, address, email, Nequi details, and internal notes. The page explains that availability and shipping cost require administrator confirmation, product payment happens in advance through Nequi only after instruction, shipping is paid on delivery, and payment proof sent through WhatsApp always requires human verification.

## T5 guest-order foundation

Migration `supabase/migrations/202604020004_guest_orders.sql` adds private order and item snapshots, RLS, and the service-role-only creation function `create_guest_order_atomic`, reached publicly only through `/api/orders`. The RPC starts orders in pending confirmation, accepts a high-entropy UUID idempotency key, snapshots published product data, validates active stock without reserving or deducting inventory, and classifies local delivery by normalized city equality with the configured dispatch origin. Shipping cost, payment confirmation, proof, and administrative overrides remain later workflow concerns.

`POST /api/orders` validates buyer and Colombian delivery data before any provider call, accepts realistic alphanumeric Colombian neighborhood names while keeping department/city strict, requires configured public WhatsApp, reads that setting through the anon client, invokes the validated RPC through the server-only service-role client, and returns only a safe order receipt with database-authoritative item summaries plus a structured itemized WhatsApp handoff. New orders are limited per normalized phone/document in a short database window; same-key replays are exempt. Production WAF/edge limits remain an external defense. Spanish errors distinguish invalid input, stock conflicts, rate limiting, missing WhatsApp configuration, idempotent replay, and ambiguous database failure. The cart and checkout UI consume this route without trusting browser prices or names. Administrator order operations, payment verification, shipment updates, and public tracking are implemented in the T6 section below.

This bounded slice covers T5 S4-S6, the delivery-data portion of S5, and the stock-at-creation rule from S9.

## T6 order operations and tracking

Migration `supabase/migrations/202604020005_order_operations.sql` adds configurable Colombian carriers, payment-confirmation provenance, shipping and guide snapshots, cancellation metadata, immutable status history, and actor-bound audit events. Authenticated administrator mutations run only through row-locking security-definer RPCs with optimistic version checks. Legal transitions are enforced in the database, the confirmed Nequi amount must equal the product subtotal, shipment requires configured carrier/guide/cost data, and delivered or canceled orders are terminal. None of these operations deducts or restores inventory automatically.

The protected `/admin/orders` dashboard exposes buyer and delivery data only to active administrators. It requires explicit human payment confirmation, derives tracking links from validated public HTTPS carrier templates, records manual delivery-type overrides, and supports pending confirmation, awaiting payment, payment confirmed, preparing, shipped, delivered, and canceled states.

Public tracking uses an HMAC-signed path derived from the private `ORDER_TRACKING_SECRET`; invalid tokens are rejected before creating a service-role client. `/track/:token` returns only the order number, operational status/history, non-sensitive item snapshots, delivery type, shipping cost, carrier, guide, and validated carrier link. It never returns buyer name, document, phone, email, address, neighborhood, administrator actors, or internal payment notes. The signed tracking URL is included in the structured WhatsApp handoff and checkout success screen.

## Deployment checklist

1. Copy `config/env.example` to `.env.local` and configure every value. Generate `SETUP_SECRET` and `ORDER_TRACKING_SECRET` separately with `openssl rand -hex 32`; never expose them through `NEXT_PUBLIC_` variables.
2. Apply migrations in order: `202604020001_auth_onboarding.sql` through `202604020005_order_operations.sql`.
3. Configure Cloudinary server credentials and verify one authenticated upload, storefront delivery, and deletion against the real provider.
4. Complete `/setup` once, create individual administrator invitations, and verify suspended accounts lose access.
5. Configure WhatsApp, Nequi instructions, dispatch origin, thresholds, and carriers in the protected panel.
6. Create a test order and verify idempotent retry, human payment confirmation, manual inventory adjustment, shipping guide, WhatsApp handoff, and the signed public tracking page.
7. Configure production WAF/edge rate limits for `/api/orders`; the database limit remains defense in depth.
8. Before release, run the checks below and verify responsive keyboard operation on representative mobile and desktop browsers.

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

Current automated evidence: 223 tests, lint, typecheck, production build, diff checks, secret scans, and the production dependency audit pass. Live Supabase migrations/RLS/concurrency, Cloudinary operations, WhatsApp behavior, carrier links, WAF configuration, and real-browser responsive/accessibility behavior remain deployment checks.

## Project structure

```text
app/          App Router pages, public catalog/product routes, protected admin/auth routes, and global styles
components/   Reusable public-shell and admin components
lib/          Store constants, auth policy/services, storefront query/data helpers, and Supabase server clients
supabase/     RLS migration for administrator onboarding and audit events
tests/        Observable shell, auth-domain, and security invariant tests
```
