# REST API

All paths below are relative to `/api`. JSON mutation requests use `Content-Type: application/json`. Browser requests are same-origin. Authentication is supplied by an HTTP-only session cookie. Error responses contain `error` and a correlation `requestId`; status codes distinguish validation (422), authentication (401), authorization (403), missing records (404), conflicts (409), payload size (413), and throttling (429).

| Method      | Path                            | Access                 | Purpose                                                         |
| ----------- | ------------------------------- | ---------------------- | --------------------------------------------------------------- |
| GET         | `/health`                       | Public                 | Database connectivity                                           |
| GET         | `/session`                      | Public                 | Current account and configured capabilities                     |
| POST        | `/auth/register`                | Public                 | Customer registration; roles cannot be supplied                 |
| POST        | `/auth/login`                   | Public                 | Normal account authentication                                   |
| POST        | `/auth/logout`                  | Signed in              | Revoke current session                                          |
| POST        | `/auth/demo`                    | Demo enabled           | Select customer/admin/delivery in an isolated demo workspace    |
| GET         | `/products`                     | Public                 | Active catalog for the current store/workspace                  |
| GET, POST   | `/addresses`                    | Customer               | List or save owned addresses                                    |
| DELETE      | `/addresses/:id`                | Owner                  | Remove saved address                                            |
| GET, POST   | `/orders`                       | Customer               | Recent 100 owned orders or checkout                             |
| GET         | `/orders/:id`                   | Owner                  | Complete order, timeline, partner, location, customer code      |
| POST        | `/orders/:id/cancel`            | Owner                  | Cancel an eligible unpaid cash order                            |
| GET         | `/admin/stats`                  | Admin                  | Full-store aggregate order/revenue/product/stock counters       |
| GET, POST   | `/admin/products`               | Admin                  | Complete inventory, or add a product                            |
| PUT, DELETE | `/admin/products/:id`           | Admin                  | Replace validated product fields, or archive it                 |
| GET, POST   | `/admin/partners`               | Admin                  | List or create partners                                         |
| PATCH       | `/admin/partners/:id`           | Admin                  | Set active status                                               |
| GET         | `/admin/orders`                 | Admin                  | Recent 100 workspace orders; no customer delivery code          |
| PATCH       | `/admin/orders/:id`             | Admin                  | Confirm, pack, or cancel; optionally assign active partner      |
| GET         | `/delivery/orders`              | Delivery               | Assigned orders and available packed pickups; no delivery codes |
| PATCH       | `/delivery/orders/:id`          | Delivery               | Accept/start or verify/complete a delivery                      |
| POST        | `/delivery/orders/:id/location` | Assigned partner       | Store validated coordinates during dispatch                     |
| POST        | `/media`                        | Admin                  | Raw PNG/JPEG/WebP upload, 2 MiB maximum                         |
| GET         | `/media/:id`                    | Public                 | Immutable uploaded product image                                |
| POST        | `/newsletter`                   | Public                 | Idempotently store validated subscription                       |
| POST        | `/stripe/webhook`               | Valid Stripe signature | Confirm payment or release expired reservation                  |

## Checkout contract

```json
{
  "items": [{ "productId": "catalog-product-id", "quantity": 2 }],
  "address": {
    "label": "Home",
    "name": "Fictional Customer",
    "phone": "+1 503 555 0100",
    "street": "123 Fictional Avenue",
    "city": "Portland",
    "state": "Oregon",
    "zip": "97201",
    "lat": 45.5152,
    "lng": -122.6784
  },
  "payment": "cash",
  "coupon": "FRESH10",
  "idempotencyKey": "a-client-generated-uuid-v4"
}
```

Coordinates and coupon are optional. Send a fresh UUID for each new checkout intent; retain it when retrying the same submission. The server snapshots current prices and recalculates all money. Unknown fields such as `total`, `role`, and `paid` never override server decisions. All money in API responses is integer USD cents. List endpoints currently return the most recent 100 orders; direct order details remain available for older records.

Delivery completion accepts `{"status":"Delivered","otp":"123456"}`. Only the customer receives the real code. Delivery state changes are conditional updates, so competing claims cannot both succeed.
