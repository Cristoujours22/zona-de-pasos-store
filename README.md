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

## Project structure

```text
app/          App Router layout, homepage, and global styles
components/   Reusable public-shell components and icons
lib/          Store-facing constants
public/       Static assets (reserved)
tests/        Observable shell behavior tests
```
