# InstantMart

**A little fresher. A lot better.**

A full-stack grocery commerce platform by **Ramtin Babaei**, with a customer storefront, store management studio, and delivery partner workspace. Built with React, TypeScript, Tailwind CSS, and a transactional SQL backend on Cloudflare Workers.

**[Open the online demo](https://instantmart-ramtin.shaficp.chatgpt.site)** · **[Source code](https://github.com/RamtinBabaei/instantmart)** · [Testing report](docs/TESTING_REPORT.md) · [Architecture](docs/ARCHITECTURE.md)

This is a working portfolio demo. Demo orders do not dispatch groceries or collect money. It is not represented as a commercially launched grocery service.

## Explore the complete experience

1. Open the demo, click **Sign in → Explore customer demo**.
2. Browse categories, search products, and fill your basket.
3. At checkout, use a fictional demo address, select cash on delivery, and optionally apply **FRESH10**.
4. Place the order and open its tracking page.
5. Use **Admin** in the demo banner, open **Orders**, confirm the order, then mark it as packed.
6. Use **Delivery**, open **Available**, and accept the delivery. You can send an explicitly fictional demo location or voluntarily share real GPS on a secure connection.
7. Use **Shop**, return to your order, and note the six-digit delivery code. In **Delivery**, enter that code to complete the handoff.
8. Return to the customer order to see the completed timeline and payment state.

Each browser receives an isolated demo workspace. Product edits and orders in your workspace do not alter another visitor’s demo. Demo access can be disabled by setting `DEMO_ENABLED=false`.

## Features

### Customer experience

- Responsive storefront using the supplied grocery imagery and reference color/type system.
- Ten category aisles and 27 initial products; search, category filters, organic/in-stock filters, price/name sorting, and product details.
- Persistent basket, quantity controls, server-verified prices, free-delivery threshold, tax breakdown, and promotional savings.
- Account registration, sign-in, sign-out, private saved addresses, and order history.
- Working cash checkout; optional Stripe-hosted card checkout with signed webhook verification.
- Live status polling, an actual-coordinate map, assigned partner details, cancellation before dispatch, and a customer-only delivery code.
- Accessible labelled controls, native modal focus management, keyboard focus styles, reduced-motion support, and actionable error/empty states.

### Store management

- Database-backed order, revenue, product, and low-stock statistics.
- Product creation/editing, stock updates, image upload to R2, and reversible product archiving.
- Order confirmation, packing, cancellation, and optional delivery-partner assignment.
- Delivery partner creation, activation, and deactivation.

### Delivery operations

- Available pickups, assigned active deliveries, and completed deliveries.
- Atomic order acceptance, location sharing with explicit permission, and verification-code handoff.
- Payment collection state and delivery status updates persisted in SQL.

Newsletter signup stores a subscription. Email campaigns and transactional email delivery are not configured. Card checkout remains unavailable without both Stripe secrets; the public demo does not charge cards.

## Technology choices

| Layer          | Technology                                          | Why                                                                        |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| UI             | React 19, TypeScript, Tailwind CSS 4                | Typed components, reusable styling primitives, responsive layouts          |
| Framework      | Next-compatible App Router through Vinext + Vite    | Full-stack React on Cloudflare Workers without a separate API deployment   |
| Backend        | TypeScript REST handlers, Zod, Web Crypto           | Explicit validation, server-side authorization, bounded payloads           |
| Database       | Cloudflare D1 (SQLite), Drizzle schema/migrations   | Durable relational storage, transactional batch writes, edge deployment    |
| Product images | Cloudflare R2                                       | Persistent validated uploads                                               |
| Client state   | React context and local storage                     | A small shared basket/session does not require an additional state library |
| Payments       | Stripe Checkout REST API + HMAC-verified webhooks   | Hosted card entry; card details never enter the application                |
| Tests          | Vitest, Testing Library, Miniflare, Playwright      | Component, real local D1 integration, and complete browser journeys        |
| Quality        | ESLint, Prettier, GitHub Actions, dependency audits | Repeatable checks and a reproducible lockfile                              |

Drizzle generates and documents the schema. Runtime queries use parameterized SQL directly so inventory reservations and status transitions remain explicit and auditable. No Docker, separate Express service, or external PostgreSQL account is needed for local development.

## Run locally in VS Code

Install **Node.js 24 LTS**, **Git**, and **VS Code**. A Cloudflare account and Stripe keys are **not** needed for local demo mode.

```bash
git clone https://github.com/RamtinBabaei/instantmart.git
cd instantmart
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm dev
```

Open **http://localhost:5173**. On Windows, run each line in the VS Code PowerShell terminal; do not try to execute the YAML workflow file as a command.

`pnpm db:migrate` creates the local database schema. The initial catalog is inserted idempotently on first use. Your local database and uploaded images are stored in the ignored `.wrangler/state` directory; they are separate from the hosted demo.

Optional local settings:

```powershell
Copy-Item .env.example .dev.vars
```

On macOS/Linux, use `cp .env.example .dev.vars`. The default demo works without this file.

To verify the application:

- Open **http://localhost:5173/api/health**. Expect `{"status":"ok","database":"connected"}`.
- Follow the customer → admin → delivery journey above.
- Reload a page to verify basket/order persistence.
- Try a wrong delivery code and an invalid promo code to verify errors.

For a preview of the production build:

```bash
pnpm build
pnpm start -- --port 8787
```

Open **http://localhost:8787**. Stop a running server with **Ctrl+C**. Full Windows/VS Code guidance is in [the Persian local setup guide](docs/LOCAL_SETUP_FA.md).

## Quality commands

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm check:bundle
pnpm audit --prod
pnpm test:e2e
```

The Playwright suite starts the built Worker on port 8787. Run `pnpm build` and `pnpm db:migrate` first, then install its browser with `pnpm exec playwright install --with-deps chromium`. `E2E_BASE_URL` can target an already-running local environment.

See [the testing report](docs/TESTING_REPORT.md) for executed results, browser verification scope, security audit findings, and limits. A passing build is not a claim of commercial production readiness.

## Project organization

| Location            | Responsibility                                                      |
| ------------------- | ------------------------------------------------------------------- |
| `app/`              | App Router entries, API adapter, metadata, Tailwind design system   |
| `components/store/` | Storefront, checkout, account, admin, and delivery interfaces       |
| `lib/commerce.ts`   | Integer-money calculations and allowed order transitions            |
| `lib/validation.ts` | Shared Zod request schemas                                          |
| `lib/server/`       | Authentication, security, repositories, API orchestration, payments |
| `db/schema.ts`      | Typed relational schema                                             |
| `drizzle/`          | SQL migrations, inventory/audit triggers, migration metadata        |
| `public/`           | Local compressed imagery, self-hosted fonts, licenses               |
| `tests/`            | Unit, component, D1 integration, and browser journey tests          |
| `scripts/`          | Build, local migration, bundle-budget, and deployment helpers       |
| `docs/`             | Architecture, API, deployment, QA, and local setup documentation    |

## Deploy and operate

Read [the deployment guide](docs/DEPLOYMENT.md). The current demo uses a Cloudflare Workers runtime with provisioned D1/R2 storage. The hosting manifest is tracked; secrets and local runtime state are ignored.

Before a commercial launch, configure real payment credentials and webhook delivery, regional taxes, service areas, email/account recovery, refunds, retention, operational monitoring, and customer support. Do not use the demo’s open role-switching mode for a commercial store.

## Reference and licensing

Implementation and application logic were authored for this project. Design direction and supplied grocery imagery follow the [InstantMart project reference](https://greatstack.dev/p/instantmart). Its linked live preview was paused during implementation; the downloadable assets, typography tokens, schema, and UI examples were inspected instead.

Application source is MIT licensed. Third-party photographs, fonts, icons, and build integrations retain their own terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
