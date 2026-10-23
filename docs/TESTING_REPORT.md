# Testing, debugging, and release report

Validation date: **October 23, 2026**. This report distinguishes executed checks from supplied test configuration and unavailable external verification.

## Pass 1 — Architecture and code quality

- Reviewed request boundaries, scoped repositories, session storage, schema/migrations, inventory triggers, role permissions, payment state, and browser state ownership.
- Moved the store provider into the root layout to retain session/basket state across navigation and avoid repeated initialization requests.
- Kept domain rules, Zod schemas, cryptography, data projections, payment logic, and UI components separate.
- Removed unused UI scaffold components and unnecessary runtime dependencies.
- Ran strict TypeScript checking successfully. Ran ESLint with zero warnings and errors. Prettier verification is part of final validation.
- Generated Cloudflare binding declarations with Wrangler, rather than inventing binding types. The application’s test/runtime configuration derives its storage types from those declarations.

## Pass 2 — Functionality and integration

**Executed: 45 passing automated tests in four Vitest files.** The API integration tests use Miniflare’s real local D1 and R2 implementations, apply the actual SQL migration, and invoke the real API handlers. Database behavior is not replaced with a mocked repository.

| Area           | Executed coverage                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money          | Integer cents, delivery threshold, empty baskets, rounding, promo cap, discounted tax                                                                                  |
| Validation     | Email normalization, privilege fields, passwords, addresses, GPS ranges, duplicate/fractional/negative quantities, image paths, prices                                 |
| Authentication | Salted hashes, correct/incorrect login, registration, duplicate email, HTTP-only/Secure cookies, logout revocation, disabled demo mode                                 |
| Authorization  | Anonymous access, customer/admin separation, owner-only addresses and orders, isolated demo workspaces                                                                 |
| Abuse controls | Authentication throttling, oversized JSON, cross-origin writes, invalid JSON                                                                                           |
| Inventory      | Product CRUD/archiving/restoring, last-unit race, full batch rollback, cancellation restoring stock once                                                               |
| Fulfillment    | All three roles, valid transition order, rejected status jumps, private OTP projection, wrong code, successful delivery, persistent location, paid state               |
| Product media  | Real R2 upload/readback, image signature validation, customer upload rejection                                                                                         |
| Payments       | HMAC signing, payload tampering, stale signatures, unconfigured endpoint, invalid callback signature, amount/currency/session checked callback, idempotent paid update |
| UI             | Accessible add/quantity controls, sold-out state, error announcements                                                                                                  |
| Client runtime | Secure UUID fallback in an HTTP development preview                                                                                                                    |
| Other records  | Private address lifecycle, partner creation/deactivation, idempotent subscription storage                                                                              |

**Executed browser verification in Chromium:** storefront navigation, native sign-in modal, isolated customer demo, add-to-basket, persisted basket after reload, checkout address steps, cash checkout, admin confirmation/packing, delivery acceptance, fictional coordinate submission, wrong-code rejection, valid-code completion, and the final customer timeline/paid state.

Responsive rendering was visually inspected in 375px and 768px iframe viewports, plus the full desktop viewport. Additional final smoke checks cover search, promo application, and the finalized deployment artifact. No real browser GPS permission was granted; deterministic demo coordinates were used. The backend coordinate authorization/storage path was tested.

A five-test Playwright suite is supplied for the same complete journey, catalog search/persistence, and three viewport widths. CI is configured to run it against a built Worker. The CLI suite was not executed in the authoring container, whose browser checks used the provided controlled Chromium environment. Any later CI status is independently visible in GitHub Actions and should not be inferred from this statement.

### Issues found and fixed

1. The supplied local runtime rejected the initially requested compatibility date. Updated Wrangler/Cloudflare tooling and pinned a date actually supported by the installed Workerd binary.
2. Changed API route exports to explicit HTTP handler functions for reliable framework discovery.
3. The HTTP preview lacked `crypto.randomUUID`. Added a Web Crypto `getRandomValues` UUID fallback and regression test.
4. Made promo application explicit for clicks and the Enter key, preserving normalized applied state. Retested the displayed discount and matching server total ($7.24 for a $4.50 basket after the promo, $2.99 delivery, and $0.20 tax). The controlled browser needed a settled click position because the summary sticks while scrolling.
5. Added full-store admin aggregate queries rather than deriving totals from a capped order list.
6. Made direct order tracking fetch the requested order independently of the recent-order list cap.
7. Prevented manual cancellation of an active card-payment reservation; its signed provider expiry owns cancellation and stock release.
8. Automatically select the active/completed delivery tab after accepting/completing an order.
9. Upgraded vulnerable framework/runtime/tool dependencies and pinned patched transitive versions in the pnpm 11 workspace configuration.

## Pass 3 — Performance, security, and release scope

Executed production builds succeed with the current dependency lockfile. Vinext emits an informational route-classification notice and upstream RSC sourcemap warnings; these do not fail the build. Lint/type checks are independent of build success.

Measured production transfer sizes before the final no-functional-change documentation pass:

| Asset class                               | Measured bytes |
| ----------------------------------------- | -------------: |
| All JavaScript chunks combined, gzip      |        187,292 |
| All CSS, gzip                             |         14,516 |
| Largest individual JavaScript chunk, gzip |         67,653 |
| Desktop hero WebP                         |        231,126 |
| Mobile hero WebP                          |         73,570 |
| All self-hosted WOFF2 fonts               |        104,536 |

The exact final measurements are emitted by `pnpm check:bundle`. Budgets enforce JavaScript/CSS/chunk/image/font limits. Admin and delivery bundles load separately. These are build measurements, **not** a Lighthouse score or field Core Web Vitals result. Lighthouse, real-user LCP/INP/CLS, load testing, and broad device/network benchmarking were not executed.

### Dependency audit

After updating the framework, React/RSC, Vite, Cloudflare tooling, and patched transitive dependencies:

- `pnpm audit --prod`: **zero known vulnerabilities** at the time executed.
- Full `pnpm audit`: **one high-severity development-only advisory** in `braces`, for stack exhaustion with deeply nested glob patterns. The advisory reported no patched version. Its dependency paths are build/lint tooling; the application does not accept user-controlled build glob patterns. It is not silently ignored or described as fixed.

Package audit findings can change. Re-run both audits before later releases. Tooling peer declarations should also be reviewed when updating ESLint or framework integrations.

### Verification limits

- Stripe Checkout creation against a real test/live account was not executed; no credentials were supplied. The integration and signed callback/database behavior were tested locally. Public demo card checkout is unavailable by design.
- No automatic refunds, password reset/verified email, real delivery dispatch, email sending, automatic demo cleanup, or region-specific tax engine is claimed.
- OpenStreetMap is an external service; map availability depends on network/provider access. No fabricated route, partner movement, or ETA is shown.
- The authoring browser was Chromium. Firefox, WebKit, real iOS/Android, and screen-reader audits were not executed in that environment.
- No commercial operations readiness, penetration-test certification, or vulnerability-free guarantee is claimed.

The delivered result is a functional, tested portfolio application and deployable demo, with commercial launch requirements documented explicitly.
