# Deployment and operation

## Current hosted demo

Demo: **https://instantmart.ramtinbabaei-portfolio.workers.dev**

Source: **https://github.com/RamtinBabaei/instantmart**

The hosted application uses Cloudflare Workers with a durable D1 SQL database and an R2 product-image bucket. `.openai/hosting.json` records its hosting identity and logical storage bindings. The source and built deployment artifact are versioned together; hosted migrations apply before the Worker becomes live. Local and hosted databases are separate.

The application exposes its own customer/demo authentication rather than relying on a developer’s local machine. Demo roles are confined to separate workspaces. Setting `DEMO_ENABLED=false` disables the demo-role endpoint and hides demo sign-in buttons.

Do not copy an existing hosting project ID into an unrelated new site. Reuse it only when updating this same hosted project. Credentials are supplied at deployment time and are not part of the repository or ZIP.

## Deploy to your own Cloudflare account

The repository also includes a standalone configuration preparation script. It writes an ignored local deployment configuration with the correct built entrypoint and asset directory. You need Workers, D1, and R2 enabled in the account.

1. Install dependencies, validate, and build:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:bundle
```

2. Authenticate Wrangler and provision resources:

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create instantmart-db
pnpm exec wrangler r2 bucket create instantmart-products
```

3. Copy the D1 database UUID from the create response. Substitute it in the next command. Resource identifiers are not secrets.

```bash
pnpm deploy:prepare -- --database-id YOUR_D1_DATABASE_UUID --bucket instantmart-products --name instantmart --demo-enabled true
```

The output is `.cloudflare/wrangler.json`. Omit `--demo-enabled true` for a commercial environment. Never put API tokens or payment secrets in this file.

4. Apply the schema and deploy:

```bash
pnpm exec wrangler d1 execute DB --remote --config .cloudflare/wrangler.json --file drizzle/0000_loose_galactus.sql
pnpm exec wrangler deploy --config .cloudflare/wrangler.json
```

Apply each later migration once, in journal order. Do not rerun the initial schema against a database where it already exists. Back up live data before schema changes. Rebuild and rerun `deploy:prepare` when the build/configuration changes. Wrangler prints the account-specific Workers URL after a successful deployment; use that returned URL rather than guessing a subdomain.

Use `wrangler deploy --dry-run --config .cloudflare/wrangler.json` to check an artifact without publishing. The source’s compatibility date is pinned to `2026-08-06`, the latest date supported by the installed Workerd runtime used in validation; update and retest the toolchain before advancing it.

## Accounts and operator access

Public registration creates customer accounts only. For local operator testing, register an account, then run:

```bash
pnpm db:admin your-registered-email@example.com
```

Sign out and back in. This helper targets only the local D1 database. For a real deployment, promote the intended existing account with a parameterized operator database action in your authenticated database console; do not add a public role-promotion endpoint. Delivery partners can be created by an authenticated administrator.

## Optional Stripe configuration

Cash checkout works without payment credentials. Card checkout requires both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Add real values using Wrangler’s secure interactive secret input (or the hosting environment-variable interface), never a source file or a command-line literal:

```bash
pnpm exec wrangler secret put STRIPE_SECRET_KEY --config .cloudflare/wrangler.json
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET --config .cloudflare/wrangler.json
```

Register `https://YOUR_DEPLOYED_ORIGIN/api/stripe/webhook` in Stripe for `checkout.session.completed` and `checkout.session.expired`. Test with Stripe test-mode credentials first. Match the webhook signing secret to that exact endpoint.

The server creates a hosted Checkout Session, verifies signatures within a five-minute replay window, checks session/order identity, currency and amount, and marks paid state only from the signed callback. Returning to the success URL does not mark a payment paid. Unfinished reservations expire after 30 minutes and release stock after the provider’s signed expiry callback. Automatic refunds and provider-outage reconciliation are not implemented; they require an operator process before real-money operation.

The public portfolio demo disables card payment for demo identities, even when secrets exist. No Stripe account, key, or actual charge was available during delivery validation, so a real provider checkout was not claimed as tested.

## CI and release checks

GitHub Actions runs type checking, linting, formatting, unit/component/D1 tests, the production dependency audit, build, bundle budgets, and the Playwright suite against a built local Worker. Browser failures retain reports as workflow artifacts. Inspect the actual workflow result in GitHub; presence of a workflow file alone does not mean it passed.

No automatic deploy-on-push workflow is included: publishing credentials belong in an explicit operator-controlled deployment environment. This avoids placing account tokens in a portfolio repository. The checked application is published separately with a matching source version and built artifact.

## Remaining commercial launch work

- Enable a verified email/password recovery flow and stronger operator account security.
- Configure actual service areas, regional taxes, stock replenishment, delivery staffing, and customer support.
- Verify Stripe test/live payments, retries, expiry delivery, refunds, and reconciliation with real provider credentials.
- Configure a transactional email provider if order/low-stock emails are needed. Newsletter signup currently stores records only.
- Establish retention, demo cleanup, account deletion/export, backup/restore drills, and monitoring/alerting.
- Replace the latest-100 order list cap with pagination for a high-volume store. Direct order links and admin aggregate counts are independent of that cap.
- Resolve the documented development-only dependency advisory when an upstream patch becomes available.

These are explicit limits of a portfolio deployment, not hidden integrations or simulated production capabilities.

## Public demo address

The public URL above is served by the account’s dedicated Cloudflare Worker gateway. The gateway forwards requests to the existing application service, preserving its database, uploads, sessions, and application behavior. This changes the public address without migrating or resetting application records. The origin is configured as the `SOURCE_ORIGIN` Worker secret and is not committed to source. Gateway code is in `infrastructure/public-domain/worker.mjs`.
