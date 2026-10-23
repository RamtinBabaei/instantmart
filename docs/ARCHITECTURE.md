# Architecture and engineering decisions

## One deployable application

React components run in the browser; Next-compatible App Router entries run through Vinext and Vite on a Cloudflare Worker. A same-origin `/api` boundary avoids a separate CORS/authentication deployment. Zod validates request bodies before business logic. The backend never trusts client prices, totals, roles, stock claims, or payment state.

The application is split into presentation components, shared domain types/rules, request schemas, repository projections, authentication/security utilities, payment integration, and API orchestration. `app/api/[...path]/route.ts` is deliberately thin. The API orchestrator keeps each route’s authorization adjacent to its scoped SQL query.

The application uses D1 rather than an external PostgreSQL server because its query and transaction requirements fit SQLite, it runs locally without an account, and hosted storage can be provisioned beside the Worker. Drizzle owns schema declarations and migration metadata. Parameterized SQL owns runtime access. There is no request-time DDL.

## Data boundaries

Normal accounts belong to the `store` workspace. Public registration always assigns the customer role. Administrator promotion is an explicit operator database action; the public API cannot promote users.

Demo role changes are allowed only in a random, browser-scoped demo workspace. All three demo identities share that workspace while retaining distinct user IDs and roles. Product rows use a composite `(workspace_id, id)` key. Order, inventory, and partner queries scope their access on the server. Customer orders additionally require ownership; delivery orders require assignment or a packed/unassigned pickup.

Sessions use random opaque tokens in HTTP-only, SameSite cookies. Only SHA-256 token hashes are stored. Passwords use independent random salts and PBKDF2-SHA256 with 100,000 iterations, compatible with this Workers runtime. Session cookies expire after seven days. Sign-out revokes the current session. Inactive partners lose access on their next request. A commercial deployment should add verified email, account recovery, MFA/SSO for operators, stronger abuse controls, and a formal password policy.

## Transactional inventory

Checkout validates unique product IDs and integer quantities, loads current product records, recalculates integer-cent totals, and inserts the order and item snapshots in one D1 batch transaction.

A database trigger reserves stock for each item. It aborts if stock is insufficient, the product is inactive/missing, or quantity is not positive. D1 rolls back the entire batch on failure. Two competing checkouts cannot both take the final unit.

Order snapshots preserve the purchased product name, unit, image, and price independently of later catalog changes. A unique `(user_id, idempotency_key)` index prevents duplicate checkout submissions. A retry returns the existing completed order or a meaningful conflict for a payment already being processed.

Cancellation is a compare-and-set status update. A trigger returns inventory only on the first transition to Cancelled. A separate trigger records status changes in the audit timeline. Failed or repeated changes do not restore stock twice.

## Fulfillment state machine

Cash order flow:

`Placed → Confirmed → Packed → Out for Delivery → Delivered`

Admins confirm and pack. An assigned/eligible delivery partner starts dispatch and completes it with a valid six-digit customer code. Customers and admins can cancel eligible unpaid cash orders before dispatch. Direct jumps and reversals are rejected. Completion sets cash payment collection state only after code verification.

Payment reservations use Awaiting payment. A verified Stripe completion moves that order to Placed and marks it paid. A signed expiry event cancels the reservation. Awaiting-payment orders cannot be manually cancelled while a provider checkout session is still active; sessions are configured to expire after 30 minutes. Automatic refunds are not implemented.

The API never returns the delivery code to admins or delivery partners. Wrong-code attempts are rate-limited. Partner location writes require the assigned partner and Out for Delivery status. The UI polls every ten seconds while visible; it never fabricates GPS movement or an arrival estimate.

## Security controls

- Bounded JSON bodies (32 KiB) and uploaded images (2 MiB).
- Same-origin checks and JSON content requirements on writes; no permissive CORS.
- Separate authentication/write/upload/OTP rate limits stored in D1.
- Server-side role, ownership, active-account, and workspace checks.
- Parameterized SQL, strict Zod schemas, integer money, and server-generated identifiers.
- Product uploads accept PNG/JPEG/WebP only, check format signatures, reject SVG and arbitrary external image URLs, and use random object keys.
- Production CSP, content-type protection, referrer policy, and camera/microphone restrictions.
- Structured internal error IDs; no request bodies, passwords, delivery codes, or payment secrets are logged intentionally.
- Stripe HMAC signature, timestamp, currency, amount, payment session, and state checks; duplicate callbacks are harmless.

Product images are intentionally public storefront assets. The public demo is for fictional data; it is not an invitation to upload personal documents. Account deletion/export, automatic demo cleanup, malware scanning, and commercial retention procedures remain operator work.

## Performance

Images are local precompressed WebP files. The hero has a smaller mobile source and high fetch priority; below-the-fold images load lazily. Local WOFF2 fonts use swap and preload. Product cards reserve image dimensions. Admin and delivery code are separate lazy chunks. The persistent root provider prevents basket/session refetches on ordinary navigation. Catalogue filtering is local over a small dataset; order APIs cap list responses at the latest 100 records, with direct order detail access independent of that list. Admin aggregates use all relevant records.

Indexed workspace/product, user/date, status, session expiry, address-owner, and timeline queries avoid unbounded scans for the common paths. Order projections batch item/event retrieval rather than fetching each order’s children separately. All private API responses use no-store. Bundle budgets are enforced separately from unmeasured field Core Web Vitals.
