import { z } from "zod";
import {
  addressSchema,
  checkoutSchema,
  credentialsSchema,
  emailSchema,
  partnerSchema,
  productSchema,
  registerSchema,
} from "../validation";
import { calculateTotals, canTransition } from "../commerce";
import {
  body,
  checkOrigin,
  constantEqual,
  cookies,
  hash,
  HttpError,
  passwordHash,
  rateLimit,
  setCookie,
  verifyPassword,
} from "./security";
import {
  currentUser,
  demoUser,
  ensureCatalog,
  issueSession,
  requireRole,
} from "./auth";
import { getOrders, getProducts, publicUser, type UserRow } from "./repository";
import { createStripeCheckout, verifyStripeSignature } from "./payments";
import type { Status } from "../types";

export type RuntimeEnv = Partial<Pick<Cloudflare.Env, "DB" | "BUCKET">> & {
  DEMO_ENABLED?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};
const statusSchema = z.object({
  status: z.enum([
    "Confirmed",
    "Packed",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ]),
  otp: z.string().length(6).optional(),
  partnerId: z.string().max(100).nullable().optional(),
});
export async function handleApi(
  request: Request,
  env: RuntimeEnv,
): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  const requestId = crypto.randomUUID();
  headers.set("X-Request-Id", requestId);
  try {
    const db = env.DB;
    if (!db)
      throw new HttpError(
        503,
        "Database is not configured. Apply the database migrations before starting.",
      );
    const url = new URL(request.url),
      path = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean),
      method = request.method;
    if (path.join("/") === "health" && method === "GET") {
      await db.prepare("SELECT count(*) FROM workspaces").first();
      return json({ status: "ok", database: "connected" });
    }
    if (path[0] === "media") {
      if (!env.BUCKET)
        throw new HttpError(503, "Product image storage is not configured.");
      if (method === "GET" && path[1] && /^[0-9a-f-]{36}$/.test(path[1])) {
        const image = await env.BUCKET.get("products/" + path[1]);
        if (!image) throw new HttpError(404, "Image not found.");
        return new Response(image.body, {
          headers: {
            "Content-Type": image.httpMetadata?.contentType ?? "image/webp",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public,max-age=31536000,immutable",
          },
        });
      }
      if (method === "POST") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin)
          throw new HttpError(403, "This request is not allowed.");
        requireRole(await currentUser(db, request), "admin");
        await rateLimit(db, request, "image-upload", 15);
        const type = request.headers.get("content-type") ?? "";
        if (!["image/png", "image/jpeg", "image/webp"].includes(type))
          throw new HttpError(415, "Upload a PNG, JPEG, or WebP image.");
        const reader = request.body?.getReader();
        if (!reader) throw new HttpError(400, "An image is required.");
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2097152) {
            await reader.cancel();
            throw new HttpError(413, "Images must be under 2 MB.");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const png =
            bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71,
          jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
          webp =
            new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
        if (!(
          (type === "image/png" && png) ||
          (type === "image/jpeg" && jpg) ||
          (type === "image/webp" && webp)
        ))
          throw new HttpError(
            422,
            "This file does not match its image format.",
          );
        const id = crypto.randomUUID();
        await env.BUCKET.put("products/" + id, bytes, {
          httpMetadata: { contentType: type },
        });
        return json({ image: "/api/media/" + id }, 201);
      }
    }
    if (method !== "GET") {
      checkOrigin(request);
      if (path[0] !== "auth") await rateLimit(db, request, "write", 120);
    }
    const user = await currentUser(db, request);
    const scope = user?.workspace_id ?? "store";
    if (path[0] === "session" && method === "GET") {
      return json({
        user: user ? publicUser(user) : null,
        demoEnabled: env.DEMO_ENABLED !== "false",
        cardEnabled: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      });
    }
    if (path[0] === "auth" && method === "POST") {
      await rateLimit(db, request, "auth", 20);
      if (path[1] === "demo") {
        if (env.DEMO_ENABLED === "false")
          throw new HttpError(404, "Demo access is disabled.");
        const { role } = await body(
          request,
          z.object({ role: z.enum(["customer", "admin", "delivery"]) }),
        );
        return json({ user: await demoUser(db, request, role, headers) });
      }
      if (path[1] === "logout") {
        const token = cookies(request).im_session;
        if (token)
          await db
            .prepare("DELETE FROM sessions WHERE token=?")
            .bind(await hash(token))
            .run();
        headers.append("Set-Cookie", setCookie("im_session", "", request, 0));
        return json({ ok: true });
      }
      if (path[1] === "register") {
        const data = await body(request, registerSchema);
        await ensureCatalog(db, "store");
        const exists = await db
          .prepare("SELECT id FROM users WHERE workspace_id=? AND email=?")
          .bind("store", data.email)
          .first();
        if (exists)
          throw new HttpError(
            409,
            "An account with this email already exists.",
          );
        const id = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO users(id,workspace_id,name,email,password,role,created_at) VALUES (?,?,?,?,?,'customer',?)",
          )
          .bind(
            id,
            "store",
            data.name,
            data.email,
            await passwordHash(data.password),
            Date.now(),
          )
          .run();
        const u = await db
          .prepare("SELECT * FROM users WHERE id=?")
          .bind(id)
          .first<UserRow>();
        if (!u) throw new HttpError(500, "Could not create your account.");
        return json({ user: await issueSession(db, request, u, headers) }, 201);
      }
      if (path[1] === "login") {
        const data = await body(request, credentialsSchema);
        const u = await db
          .prepare(
            "SELECT * FROM users WHERE workspace_id='store' AND email=? AND active=1",
          )
          .bind(data.email)
          .first<UserRow>();
        // Do equivalent password work for unknown accounts to reduce account enumeration.
        const valid = await verifyPassword(
          data.password,
          u?.password ??
            "00000000-0000-4000-8000-000000000000:" + "0".repeat(64),
        );
        if (!u || !u.password || !valid)
          throw new HttpError(401, "Email or password is incorrect.");
        return json({ user: await issueSession(db, request, u, headers) });
      }
    }
    if (path[0] === "products" && method === "GET") {
      await ensureCatalog(db, scope);
      return json({
        products: (await getProducts(db, scope)).filter((p) => p.active),
      });
    }
    if (path[0] === "newsletter" && method === "POST") {
      await rateLimit(db, request, "subscribe", 5);
      const { email } = await body(request, z.object({ email: emailSchema }));
      await db
        .prepare(
          "INSERT OR IGNORE INTO subscriptions(email,created_at) VALUES (?,?)",
        )
        .bind(email, Date.now())
        .run();
      return json({ message: "You’re on the list. Thanks for joining!" });
    }
    if (path[0] === "addresses") {
      const u = requireRole(user, "customer");
      if (method === "GET")
        return json({
          addresses: (
            await db
              .prepare(
                "SELECT id,label,name,phone,street,city,state,zip,lat,lng FROM addresses WHERE user_id=? ORDER BY rowid DESC",
              )
              .bind(u.id)
              .all()
          ).results,
        });
      if (method === "POST") {
        const a = await body(request, addressSchema);
        const count = await db
          .prepare("SELECT count(*) n FROM addresses WHERE user_id=?")
          .bind(u.id)
          .first<{ n: number }>();
        if ((count?.n ?? 0) >= 10)
          throw new HttpError(409, "You can save up to 10 addresses.");
        const id = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO addresses(id,user_id,label,name,phone,street,city,state,zip,lat,lng) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            u.id,
            a.label,
            a.name,
            a.phone,
            a.street,
            a.city,
            a.state,
            a.zip,
            a.lat ?? null,
            a.lng ?? null,
          )
          .run();
        return json({ address: { ...a, id } }, 201);
      }
      if (method === "DELETE" && path[1]) {
        await db
          .prepare("DELETE FROM addresses WHERE id=? AND user_id=?")
          .bind(path[1], u.id)
          .run();
        return json({ ok: true });
      }
    }
    if (path[0] === "orders") {
      const u = requireRole(user, "customer");
      if (method === "GET") {
        const orders = await getOrders(db, u, path[1]);
        if (path[1] && !orders.length)
          throw new HttpError(404, "Order not found.");
        return json(path[1] ? { order: orders[0] } : { orders });
      }
      if (method === "POST" && !path[1]) {
        await rateLimit(db, request, "checkout", 15);
        const data = await body(request, checkoutSchema);
        if (
          data.payment === "card" &&
          (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
        )
          throw new HttpError(
            503,
            "Card payments are not configured. Please select cash on delivery.",
          );
        if (data.payment === "card" && u.demo)
          throw new HttpError(
            422,
            "The portfolio demo uses cash on delivery only.",
          );
        if (data.coupon && data.coupon.toUpperCase() !== "FRESH10")
          throw new HttpError(422, "This promo code is not valid.");
        const old = await db
          .prepare(
            "SELECT id,status FROM orders WHERE user_id=? AND idempotency_key=?",
          )
          .bind(u.id, data.idempotencyKey)
          .first<{ id: string; status: Status }>();
        if (old) {
          if (old.status === "Awaiting payment")
            throw new HttpError(
              409,
              "This payment is already being processed. Check your order history.",
            );
          return json({ order: (await getOrders(db, u, old.id))[0] });
        }
        const all = await getProducts(db, scope);
        const items = data.items.map((i) => {
          const p = all.find((p) => p.id === i.productId && p.active);
          if (!p || p.stock < i.quantity)
            throw new HttpError(
              409,
              `${p?.name ?? "A product"} is unavailable in the requested quantity.`,
            );
          return { product: p, quantity: i.quantity };
        });
        const totals = calculateTotals(items, data.coupon),
          id = crypto.randomUUID(),
          now = Date.now(),
          status = data.payment === "card" ? "Awaiting payment" : "Placed";
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const otp = String(100000 + (random[0] % 900000));
        try {
          await db.batch([
            db
              .prepare(
                "INSERT INTO orders(id,workspace_id,user_id,address,subtotal,delivery,tax,discount,total,status,payment,otp,created_at,updated_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                id,
                scope,
                u.id,
                JSON.stringify(data.address),
                totals.subtotal,
                totals.delivery,
                totals.tax,
                totals.discount,
                totals.total,
                status,
                data.payment,
                otp,
                now,
                now,
                data.idempotencyKey,
              ),
            ...items.map((i) =>
              db
                .prepare(
                  "INSERT INTO order_items(order_id,product_id,name,image,unit,price,quantity) VALUES (?,?,?,?,?,?,?)",
                )
                .bind(
                  id,
                  i.product.id,
                  i.product.name,
                  i.product.image,
                  i.product.unit,
                  i.product.price,
                  i.quantity,
                ),
            ),
            db
              .prepare(
                "INSERT INTO order_events(id,order_id,status,created_at,note) VALUES (?,?,?,?,?)",
              )
              .bind(crypto.randomUUID(), id, status, now, "Order received"),
          ]);
        } catch (error) {
          if (
            String(error).includes("stock") ||
            String(error).includes("UNIQUE")
          )
            throw new HttpError(
              409,
              "Stock changed or this order was already submitted. Please refresh your cart.",
            );
          throw error;
        }
        if (data.payment === "card" && env.STRIPE_SECRET_KEY) {
          try {
            const payment = await createStripeCheckout(
              env.STRIPE_SECRET_KEY,
              { id, total: totals.total, email: u.email },
              url.origin,
            );
            await db
              .prepare("UPDATE orders SET payment_session=? WHERE id=?")
              .bind(payment.id, id)
              .run();
            return json(
              {
                order: (await getOrders(db, u, id))[0],
                checkoutUrl: payment.url,
              },
              201,
            );
          } catch (error) {
            await db
              .prepare(
                "UPDATE orders SET status='Cancelled',updated_at=? WHERE id=? AND status='Awaiting payment'",
              )
              .bind(Date.now(), id)
              .run();
            throw error;
          }
        }
        return json({ order: (await getOrders(db, u, id))[0] }, 201);
      }
      if (method === "POST" && path[2] === "cancel") {
        const order = (await getOrders(db, u, path[1]))[0];
        if (!order) throw new HttpError(404, "Order not found.");
        if (order.paid)
          throw new HttpError(
            409,
            "Paid orders require a store-assisted refund.",
          );
        if (!canTransition(order.status, "Cancelled", "customer"))
          throw new HttpError(409, "This order can no longer be cancelled.");
        const r = await db
          .prepare(
            "UPDATE orders SET status='Cancelled',updated_at=? WHERE id=? AND status=? AND user_id=?",
          )
          .bind(Date.now(), order.id, order.status, u.id)
          .run();
        if (!r.meta.changes)
          throw new HttpError(409, "Order changed. Please refresh.");
        return json({ ok: true });
      }
    }
    if (path[0] === "admin") {
      const u = requireRole(user, "admin");
      if (path[1] === "stats" && method === "GET") {
        const orderStats = await db
          .prepare(
            "SELECT count(*) orders,COALESCE(sum(CASE WHEN status='Delivered' THEN total ELSE 0 END),0) revenue FROM orders WHERE workspace_id=?",
          )
          .bind(scope)
          .first<{ orders: number; revenue: number }>();
        const productStats = await db
          .prepare(
            "SELECT count(*) products,COALESCE(sum(CASE WHEN stock<=10 THEN 1 ELSE 0 END),0) lowStock FROM products WHERE workspace_id=? AND active=1",
          )
          .bind(scope)
          .first<{ products: number; lowStock: number }>();
        return json({ ...orderStats, ...productStats });
      }
      if (path[1] === "products") {
        if (method === "GET")
          return json({ products: await getProducts(db, scope) });
        if (method === "POST" || method === "PUT") {
          const p = await body(request, productSchema);
          const id = path[2] ?? crypto.randomUUID();
          if (method === "PUT") {
            const r = await db
              .prepare(
                "UPDATE products SET name=?,description=?,category=?,image=?,price=?,original_price=?,unit=?,stock=?,organic=?,active=? WHERE workspace_id=? AND id=?",
              )
              .bind(
                p.name,
                p.description,
                p.category,
                p.image,
                p.price,
                p.originalPrice,
                p.unit,
                p.stock,
                +p.organic,
                +p.active,
                scope,
                id,
              )
              .run();
            if (!r.meta.changes) throw new HttpError(404, "Product not found.");
          } else
            await db
              .prepare(
                "INSERT INTO products(workspace_id,id,name,description,category,image,price,original_price,unit,stock,organic,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                scope,
                id,
                p.name,
                p.description,
                p.category,
                p.image,
                p.price,
                p.originalPrice,
                p.unit,
                p.stock,
                +p.organic,
                +p.active,
              )
              .run();
          return json({ ok: true, id }, method === "POST" ? 201 : 200);
        }
        if (method === "DELETE" && path[2]) {
          await db
            .prepare(
              "UPDATE products SET active=0 WHERE workspace_id=? AND id=?",
            )
            .bind(scope, path[2])
            .run();
          return json({ ok: true });
        }
      }
      if (path[1] === "partners") {
        if (method === "GET") {
          const r = await db
            .prepare(
              "SELECT * FROM users WHERE workspace_id=? AND role='delivery'",
            )
            .bind(scope)
            .all<UserRow>();
          return json({ partners: r.results.map(publicUser) });
        }
        if (method === "POST") {
          const p = await body(request, partnerSchema);
          await db
            .prepare(
              "INSERT INTO users(id,workspace_id,name,email,password,role,phone,vehicle,created_at) VALUES (?,?,?,?,?,'delivery',?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              scope,
              p.name,
              p.email,
              await passwordHash(p.password),
              p.phone,
              p.vehicle,
              Date.now(),
            )
            .run();
          return json({ ok: true }, 201);
        }
        if (method === "PATCH" && path[2]) {
          const { active } = await body(
            request,
            z.object({ active: z.boolean() }),
          );
          await db
            .prepare(
              "UPDATE users SET active=? WHERE id=? AND workspace_id=? AND role='delivery'",
            )
            .bind(+active, path[2], scope)
            .run();
          return json({ ok: true });
        }
      }
      if (path[1] === "orders" && method === "GET")
        return json({ orders: await getOrders(db, u) });
      if (path[1] === "orders" && path[2] && method === "PATCH") {
        const data = await body(request, statusSchema),
          order = (await getOrders(db, u, path[2]))[0];
        if (!order) throw new HttpError(404, "Order not found.");
        if (data.partnerId) {
          const partner = await db
            .prepare(
              "SELECT id FROM users WHERE id=? AND workspace_id=? AND role='delivery' AND active=1",
            )
            .bind(data.partnerId, scope)
            .first();
          if (!partner)
            throw new HttpError(422, "Choose an active delivery partner.");
        }
        if (data.status === "Cancelled" && order.paid)
          throw new HttpError(
            409,
            "Paid orders require a payment-provider refund first.",
          );
        if (!canTransition(order.status, data.status, "admin"))
          throw new HttpError(409, "That status change is not allowed.");
        const r = await db
          .prepare(
            "UPDATE orders SET status=?,partner_id=COALESCE(?,partner_id),updated_at=? WHERE id=? AND workspace_id=? AND status=?",
          )
          .bind(
            data.status,
            data.partnerId ?? null,
            Date.now(),
            order.id,
            scope,
            order.status,
          )
          .run();
        if (!r.meta.changes)
          throw new HttpError(409, "Order changed. Please refresh.");
        return json({ ok: true });
      }
    }
    if (path[0] === "delivery") {
      const u = requireRole(user, "delivery");
      if (path[1] === "orders" && method === "GET")
        return json({ orders: await getOrders(db, u) });
      if (path[1] === "orders" && path[2] && method === "PATCH") {
        const data = await body(request, statusSchema),
          order = (await getOrders(db, u, path[2]))[0];
        if (!order) throw new HttpError(404, "Order not found.");
        if (!canTransition(order.status, data.status, "delivery"))
          throw new HttpError(409, "That status change is not allowed.");
        if (data.status === "Delivered") {
          await rateLimit(db, request, "delivery-otp", 10);
          const row = await db
            .prepare("SELECT otp FROM orders WHERE id=? AND partner_id=?")
            .bind(order.id, u.id)
            .first<{ otp: string }>();
          if (!row || !data.otp || !constantEqual(row.otp, data.otp))
            throw new HttpError(
              422,
              "The delivery code is incorrect. Ask the customer for their six-digit code.",
            );
        }
        const r = await db
          .prepare(
            "UPDATE orders SET status=?,partner_id=?,updated_at=?,paid=CASE WHEN ?='Delivered' THEN 1 ELSE paid END WHERE id=? AND workspace_id=? AND status=? AND (partner_id IS NULL OR partner_id=?)",
          )
          .bind(
            data.status,
            u.id,
            Date.now(),
            data.status,
            order.id,
            scope,
            order.status,
            u.id,
          )
          .run();
        if (!r.meta.changes)
          throw new HttpError(
            409,
            "Another partner has accepted this delivery.",
          );
        return json({ ok: true });
      }
      if (
        path[1] === "orders" &&
        path[2] &&
        path[3] === "location" &&
        method === "POST"
      ) {
        const pos = await body(
          request,
          z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          }),
        );
        const r = await db
          .prepare(
            "UPDATE orders SET lat=?,lng=?,location_at=? WHERE id=? AND workspace_id=? AND partner_id=? AND status='Out for Delivery'",
          )
          .bind(pos.lat, pos.lng, Date.now(), path[2], scope, u.id)
          .run();
        if (!r.meta.changes)
          throw new HttpError(
            409,
            "Start this delivery before sharing your location.",
          );
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 429) headers.set("Retry-After", "60");
      return json({ error: error.message, requestId }, error.status);
    }
    console.error(
      JSON.stringify({
        event: "api_error",
        requestId,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return json(
      { error: "Something went wrong. Please try again.", requestId },
      500,
    );
  }
}

export async function handleWebhook(
  request: Request,
  env: RuntimeEnv,
): Promise<Response> {
  if (!env.DB || !env.STRIPE_WEBHOOK_SECRET)
    return Response.json(
      { error: "Payment webhook is not configured." },
      { status: 503 },
    );
  try {
    const reader = request.body?.getReader();
    let raw = "";
    const decoder = new TextDecoder();
    if (!reader) return new Response(null, { status: 400 });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      if (raw.length > 32768) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
    }
    raw += decoder.decode();
    if (
      !(await verifyStripeSignature(
        raw,
        request.headers.get("stripe-signature") ?? "",
        env.STRIPE_WEBHOOK_SECRET,
      ))
    )
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    const event = z
      .object({
        type: z.string(),
        data: z.object({
          object: z.object({
            id: z.string(),
            client_reference_id: z.string().nullable().optional(),
            payment_status: z.string().optional(),
            amount_total: z.number().optional(),
            currency: z.string().optional(),
          }),
        }),
      })
      .parse(JSON.parse(raw));
    const session = event.data.object;
    if (
      event.type === "checkout.session.completed" &&
      session.payment_status === "paid" &&
      session.client_reference_id &&
      session.currency === "usd"
    )
      await env.DB.prepare(
        "UPDATE orders SET paid=1,status='Placed',updated_at=? WHERE id=? AND payment_session=? AND status='Awaiting payment' AND total=?",
      )
        .bind(
          Date.now(),
          session.client_reference_id,
          session.id,
          session.amount_total ?? -1,
        )
        .run();
    if (event.type === "checkout.session.expired")
      await env.DB.prepare(
        "UPDATE orders SET status='Cancelled',updated_at=? WHERE payment_session=? AND status='Awaiting payment'",
      )
        .bind(Date.now(), session.id)
        .run();
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }
}
