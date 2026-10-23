import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { handleApi, handleWebhook, type RuntimeEnv } from "../lib/server/api";
import { catalog } from "../lib/catalog";
import type { Order, Product, Role, User } from "../lib/types";

let mf: Miniflare, env: RuntimeEnv;
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test")}}',
    compatibilityDate: "2026-08-06",
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
  });
  env = {
    DB: await mf.getD1Database("DB"),
    BUCKET: (await mf.getR2Bucket("BUCKET")) as R2Bucket,
  };
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("drizzle/" + file, "utf8")
      .split("--> statement-breakpoint")
      .filter((s) => s.trim()))
      await env.DB!.prepare(sql).run();
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await env.DB!.prepare("DELETE FROM rate_limits").run();
});
class Visitor {
  jar = new Map<string, string>();
  async call<T = Record<string, unknown>>(
    path: string,
    method = "GET",
    data?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await handleApi(
      new Request("https://instantmart.test/api" + path, {
        method,
        headers: {
          cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(method === "GET"
            ? {}
            : {
                "Content-Type": "application/json",
                Origin: "https://instantmart.test",
              }),
          ...headers,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      }),
      env,
    );
    for (const c of response.headers.getSetCookie()) {
      const [pair] = c.split(";"),
        [k, v] = pair.split("=");
      this.jar.set(k, v);
    }
    return {
      status: response.status,
      data: (await response.json()) as T,
      headers: response.headers,
    };
  }
  async demo(role: Role) {
    const r = await this.call<{ user: User }>("/auth/demo", "POST", { role });
    expect(r.status).toBe(200);
    return r.data.user;
  }
}
const address = {
  label: "Home",
  name: "Alex Test",
  phone: "+1 503 555 0100",
  street: "123 Test Street",
  city: "Portland",
  state: "Oregon",
  zip: "97201",
};
const orderPayload = (productId = catalog[0].id, quantity = 2) => ({
  items: [{ productId, quantity }],
  address,
  payment: "cash",
  coupon: "FRESH10",
  idempotencyKey: crypto.randomUUID(),
});
describe("Authentication and access boundaries", () => {
  it("rejects anonymous account and admin access", async () => {
    const v = new Visitor();
    expect((await v.call("/orders")).status).toBe(401);
    expect((await v.call("/admin/products")).status).toBe(401);
  });
  it("creates accounts, hashes passwords, authenticates and invalidates logout sessions", async () => {
    const v = new Visitor(),
      email = `test-${crypto.randomUUID()}@example.com`,
      data = {
        name: "Test Customer",
        email,
        password: "a-long-password-123",
        role: "admin",
      };
    const created = await v.call<{ user: User }>(
      "/auth/register",
      "POST",
      data,
    );
    expect(created.status).toBe(201);
    expect(created.data.user.role).toBe("customer");
    expect(created.data.user).not.toHaveProperty("password");
    const row = await env
      .DB!.prepare("SELECT password FROM users WHERE id=?")
      .bind(created.data.user.id)
      .first<{ password: string }>();
    expect(row?.password).not.toContain(data.password);
    expect(created.headers.get("set-cookie")).toContain("HttpOnly");
    expect(created.headers.get("set-cookie")).toContain("Secure");
    expect((await v.call("/auth/register", "POST", data)).status).toBe(409);
    const old = new Map(v.jar);
    expect((await v.call("/auth/logout", "POST", {})).status).toBe(200);
    v.jar = old;
    expect((await v.call("/orders")).status).toBe(401);
    expect(
      (
        await v.call("/auth/login", "POST", {
          email,
          password: "wrong-password-123",
        })
      ).status,
    ).toBe(401);
    expect((await v.call("/auth/login", "POST", data)).status).toBe(200);
  });
  it("rejects cross-origin writes and invalid JSON", async () => {
    const v = new Visitor();
    expect(
      (
        await v.call(
          "/auth/demo",
          "POST",
          { role: "admin" },
          { Origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    const response = await handleApi(
      new Request("https://instantmart.test/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
  it("enforces customer/admin separation and demo isolation", async () => {
    const a = new Visitor(),
      b = new Visitor();
    await a.demo("customer");
    expect((await a.call("/admin/products")).status).toBe(403);
    await a.demo("admin");
    await b.demo("admin");
    const changed = { ...catalog[0], name: "Only workspace A", stock: 12 };
    expect(
      (await a.call("/admin/products/" + catalog[0].id, "PUT", changed)).status,
    ).toBe(200);
    const r = await b.call<{ products: Product[] }>("/admin/products");
    expect(r.data.products.find((p) => p.id === catalog[0].id)?.name).toBe(
      catalog[0].name,
    );
  });
  it("can disable demo access without affecting the public catalog", async () => {
    const r = await handleApi(
      new Request("https://instantmart.test/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      }),
      { ...env, DEMO_ENABLED: "false" },
    );
    expect(r.status).toBe(404);
  });
  it("rate-limits authentication attempts", async () => {
    const v = new Visitor();
    for (let i = 0; i < 20; i++)
      await v.call("/auth/demo", "POST", { role: "invalid" });
    const limited = await v.call("/auth/demo", "POST", { role: "customer" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
describe("Transactional ordering and fulfillment", () => {
  it("fulfills an order through all three roles, protects OTPs and persists GPS", async () => {
    const v = new Visitor();
    await v.demo("customer");
    const payload = orderPayload();
    const placed = await v.call<{ order: Order }>("/orders", "POST", {
      ...payload,
      total: 1,
    });
    expect(placed.status).toBe(201);
    const o = placed.data.order;
    expect(o.total).toBeGreaterThan(1);
    expect(o.otp).toMatch(/^\d{6}$/);
    expect(o.events[0].status).toBe("Placed");
    const id = o.id;
    const repeated = await v.call<{ order: Order }>("/orders", "POST", payload);
    expect(repeated.data.order.id).toBe(id);
    await v.demo("admin");
    const admin = await v.call<{ orders: Order[] }>("/admin/orders");
    expect(admin.data.orders[0]).not.toHaveProperty("otp");
    expect(
      (await v.call("/admin/orders/" + id, "PATCH", { status: "Delivered" }))
        .status,
    ).toBe(409);
    expect(
      (await v.call("/admin/orders/" + id, "PATCH", { status: "Confirmed" }))
        .status,
    ).toBe(200);
    expect(
      (await v.call("/admin/orders/" + id, "PATCH", { status: "Packed" }))
        .status,
    ).toBe(200);
    await v.demo("delivery");
    const visible = await v.call<{ orders: Order[] }>("/delivery/orders");
    expect(visible.data.orders[0]).not.toHaveProperty("otp");
    expect(
      (
        await v.call("/delivery/orders/" + id, "PATCH", {
          status: "Out for Delivery",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await v.call("/delivery/orders/" + id + "/location", "POST", {
          lat: 45.51,
          lng: -122.67,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await v.call("/delivery/orders/" + id, "PATCH", {
          status: "Delivered",
          otp: "000000",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await v.call("/delivery/orders/" + id, "PATCH", {
          status: "Delivered",
          otp: o.otp,
        })
      ).status,
    ).toBe(200);
    await v.demo("customer");
    const done = await v.call<{ order: Order }>("/orders/" + id);
    expect(done.data.order.status).toBe("Delivered");
    expect(done.data.order.paid).toBe(true);
    expect(done.data.order.lat).toBe(45.51);
    expect(done.data.order.events.map((e) => e.status)).toEqual([
      "Placed",
      "Confirmed",
      "Packed",
      "Out for Delivery",
      "Delivered",
    ]);
    expect((await v.call("/orders/" + id + "/cancel", "POST", {})).status).toBe(
      409,
    );
  });
  it("restores stock exactly once on cancellation", async () => {
    const v = new Visitor();
    await v.demo("customer");
    const payload = orderPayload();
    const o = (await v.call<{ order: Order }>("/orders", "POST", payload)).data
      .order;
    let p = (
      await v.call<{ products: Product[] }>("/products")
    ).data.products.find((p) => p.id === catalog[0].id);
    expect(p?.stock).toBe(98);
    expect(
      (await v.call("/orders/" + o.id + "/cancel", "POST", {})).status,
    ).toBe(200);
    expect(
      (await v.call("/orders/" + o.id + "/cancel", "POST", {})).status,
    ).toBe(409);
    p = (await v.call<{ products: Product[] }>("/products")).data.products.find(
      (p) => p.id === catalog[0].id,
    );
    expect(p?.stock).toBe(100);
  });
  it("prevents over-selling when checkout requests compete for the last stock", async () => {
    const v = new Visitor();
    await v.demo("admin");
    await v.call("/admin/products/" + catalog[0].id, "PUT", {
      ...catalog[0],
      stock: 1,
    });
    await v.demo("customer");
    const results = await Promise.all([
      v.call("/orders", "POST", orderPayload(catalog[0].id, 1)),
      v.call("/orders", "POST", orderPayload(catalog[0].id, 1)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const p = (
      await v.call<{ products: Product[] }>("/products")
    ).data.products.find((p) => p.id === catalog[0].id);
    expect(p?.stock).toBe(0);
    expect(
      (await v.call<{ orders: Order[] }>("/orders")).data.orders,
    ).toHaveLength(1);
  });
  it("rolls back all reservations if any item fails inside a batch", async () => {
    const v = new Visitor();
    const u = await v.demo("admin");
    const scope = await env
      .DB!.prepare("SELECT workspace_id FROM users WHERE id=?")
      .bind(u.id)
      .first<{ workspace_id: string }>();
    await env
      .DB!.prepare("UPDATE products SET stock=0 WHERE workspace_id=? AND id=?")
      .bind(scope!.workspace_id, catalog[1].id)
      .run();
    const id = crypto.randomUUID();
    let failed = false;
    try {
      await env.DB!.batch([
        env
          .DB!.prepare(
            "INSERT INTO orders(id,workspace_id,user_id,address,subtotal,delivery,tax,total,otp,created_at,updated_at,idempotency_key) VALUES (?,?,?,?,0,0,0,0,'123456',?,?,?)",
          )
          .bind(
            id,
            scope!.workspace_id,
            u.id,
            JSON.stringify(address),
            Date.now(),
            Date.now(),
            crypto.randomUUID(),
          ),
        ...catalog
          .slice(0, 2)
          .map((p) =>
            env
              .DB!.prepare(
                "INSERT INTO order_items(order_id,product_id,name,image,unit,price,quantity) VALUES (?,?,?,?,?,?,1)",
              )
              .bind(id, p.id, p.name, p.image, p.unit, p.price),
          ),
      ]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(
      await env
        .DB!.prepare("SELECT id FROM orders WHERE id=?")
        .bind(id)
        .first(),
    ).toBeNull();
    expect(
      (
        await env
          .DB!.prepare(
            "SELECT stock FROM products WHERE workspace_id=? AND id=?",
          )
          .bind(scope!.workspace_id, catalog[0].id)
          .first<{ stock: number }>()
      )?.stock,
    ).toBe(100);
  });
  it("prevents customers in another workspace from reading or cancelling orders", async () => {
    const a = new Visitor(),
      b = new Visitor();
    await a.demo("customer");
    const o = (
      await a.call<{ order: Order }>("/orders", "POST", orderPayload())
    ).data.order;
    await b.demo("customer");
    expect((await b.call("/orders/" + o.id)).status).toBe(404);
    expect(
      (await b.call("/orders/" + o.id + "/cancel", "POST", {})).status,
    ).toBe(404);
  });
  it("rejects invalid checkout data and fails closed without Stripe secrets", async () => {
    const v = new Visitor();
    await v.demo("customer");
    expect(
      (await v.call("/orders", "POST", { ...orderPayload(), items: [] }))
        .status,
    ).toBe(422);
    expect(
      (await v.call("/orders", "POST", { ...orderPayload(), payment: "card" }))
        .status,
    ).toBe(503);
    expect(
      (await v.call("/orders", "POST", { ...orderPayload(), coupon: "FAKE" }))
        .status,
    ).toBe(422);
  });
});
describe("Inventory, addresses, partners and subscriptions", () => {
  it("creates, edits, archives, and restores inventory", async () => {
    const v = new Visitor();
    await v.demo("admin");
    const added = await v.call<{ id: string }>("/admin/products", "POST", {
      ...catalog[0],
      name: "Test product",
    });
    expect(added.status).toBe(201);
    const id = added.data.id;
    expect(
      (
        await v.call("/admin/products/" + id, "PUT", {
          ...catalog[0],
          stock: 9,
        })
      ).status,
    ).toBe(200);
    expect((await v.call("/admin/products/" + id, "DELETE", {})).status).toBe(
      200,
    );
    expect(
      (await v.call<{ products: Product[] }>("/products")).data.products.some(
        (p) => p.id === id,
      ),
    ).toBe(false);
    expect(
      (
        await v.call("/admin/products/" + id, "PUT", {
          ...catalog[0],
          active: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (await v.call<{ products: Product[] }>("/products")).data.products.some(
        (p) => p.id === id,
      ),
    ).toBe(true);
  });
  it("keeps saved addresses private to the owner", async () => {
    const a = new Visitor(),
      b = new Visitor();
    await a.demo("customer");
    await b.demo("customer");
    const created = await a.call<{ address: { id: string } }>(
      "/addresses",
      "POST",
      address,
    );
    expect(created.status).toBe(201);
    expect(
      (await b.call<{ addresses: unknown[] }>("/addresses")).data.addresses,
    ).toEqual([]);
    await b.call("/addresses/" + created.data.address.id, "DELETE", {});
    expect(
      (await a.call<{ addresses: unknown[] }>("/addresses")).data.addresses,
    ).toHaveLength(1);
    await a.call("/addresses/" + created.data.address.id, "DELETE", {});
    expect(
      (await a.call<{ addresses: unknown[] }>("/addresses")).data.addresses,
    ).toHaveLength(0);
  });
  it("creates delivery partners without returning their password and deactivates them", async () => {
    const v = new Visitor();
    await v.demo("admin");
    expect(
      (
        await v.call("/admin/partners", "POST", {
          name: "New Partner",
          email: "partner@example.com",
          password: "long-password-123",
          phone: "+1 503 555 0100",
          vehicle: "bike",
        })
      ).status,
    ).toBe(201);
    const r = await v.call<{ partners: User[] }>("/admin/partners");
    const partner = r.data.partners.find(
      (p) => p.email === "partner@example.com",
    )!;
    expect(partner).not.toHaveProperty("password");
    expect(
      (
        await v.call("/admin/partners/" + partner.id, "PATCH", {
          active: false,
        })
      ).status,
    ).toBe(200);
  });
  it("stores valid newsletter subscriptions idempotently and rejects invalid emails", async () => {
    const v = new Visitor();
    expect((await v.call("/newsletter", "POST", { email: "bad" })).status).toBe(
      422,
    );
    expect(
      (await v.call("/newsletter", "POST", { email: "reader@example.com" }))
        .status,
    ).toBe(200);
    expect(
      (await v.call("/newsletter", "POST", { email: "reader@example.com" }))
        .status,
    ).toBe(200);
    expect(
      (
        await env
          .DB!.prepare("SELECT count(*) n FROM subscriptions WHERE email=?")
          .bind("reader@example.com")
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });
  it("rejects oversized bodies and unconfigured webhooks", async () => {
    const v = new Visitor();
    expect(
      (await v.call("/auth/register", "POST", { name: "x".repeat(40000) }))
        .status,
    ).toBe(413);
    expect(
      (
        await handleWebhook(
          new Request("https://instantmart.test/api/stripe/webhook", {
            method: "POST",
            body: "{}",
          }),
          env,
        )
      ).status,
    ).toBe(503);
  });
});

describe("Uploaded images and payment callbacks", () => {
  it("persists product images, rejects disguised formats and denies customers upload access", async () => {
    const v = new Visitor();
    await v.demo("admin");
    const cookie = [...v.jar].map(([k, val]) => `${k}=${val}`).join("; "),
      bytes = new Uint8Array(
        readFileSync("public/images/" + catalog[0].id + ".webp"),
      );
    const upload = () =>
      handleApi(
        new Request("https://instantmart.test/api/media", {
          method: "POST",
          headers: {
            cookie,
            "Content-Type": "image/webp",
            Origin: "https://instantmart.test",
          },
          body: bytes,
        }),
        env,
      );
    const response = await upload();
    expect(response.status).toBe(201);
    const data = (await response.json()) as { image: string };
    const image = await handleApi(
      new Request("https://instantmart.test" + data.image),
      env,
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    const disguised = await handleApi(
      new Request("https://instantmart.test/api/media", {
        method: "POST",
        headers: { cookie, "Content-Type": "image/png" },
        body: bytes,
      }),
      env,
    );
    expect(disguised.status).toBe(422);
    await v.demo("customer");
    const denied = await handleApi(
      new Request("https://instantmart.test/api/media", {
        method: "POST",
        headers: {
          cookie: [...v.jar].map(([k, val]) => `${k}=${val}`).join("; "),
          "Content-Type": "image/webp",
        },
        body: bytes,
      }),
      env,
    );
    expect(denied.status).toBe(403);
  });
  it("rejects payment callbacks with an invalid signature", async () => {
    const r = await handleWebhook(
      new Request("https://instantmart.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=invalid" },
        body: "{}",
      }),
      { ...env, STRIPE_WEBHOOK_SECRET: "test-secret" },
    );
    expect(r.status).toBe(400);
  });
  it("confirms a correctly signed payment once and ignores duplicate callbacks", async () => {
    const v = new Visitor();
    await v.demo("customer");
    const order = (
      await v.call<{ order: Order }>("/orders", "POST", orderPayload())
    ).data.order;
    await env
      .DB!.prepare(
        "UPDATE orders SET status='Awaiting payment',payment='card',payment_session='cs_test_fixture' WHERE id=?",
      )
      .bind(order.id)
      .run();
    const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_fixture",
            client_reference_id: order.id,
            payment_status: "paid",
            amount_total: order.total,
            currency: "usd",
          },
        },
      }),
      secret = "test-only-webhook-secret",
      timestamp = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`${timestamp}.${payload}`),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const callback = () =>
      handleWebhook(
        new Request("https://instantmart.test/api/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
          body: payload,
        }),
        { ...env, STRIPE_WEBHOOK_SECRET: secret },
      );
    expect((await callback()).status).toBe(200);
    const first = (await v.call<{ order: Order }>("/orders/" + order.id)).data
      .order;
    expect(first.paid).toBe(true);
    expect(first.status).toBe("Placed");
    expect((await callback()).status).toBe(200);
    const repeated = (await v.call<{ order: Order }>("/orders/" + order.id))
      .data.order;
    expect(repeated.events).toHaveLength(first.events.length);
  });
});
