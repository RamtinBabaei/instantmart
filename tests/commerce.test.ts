import { describe, expect, it } from "vitest";
import { calculateTotals, canTransition, money } from "../lib/commerce";
import { catalog } from "../lib/catalog";
import {
  addressSchema,
  checkoutSchema,
  productSchema,
  registerSchema,
} from "../lib/validation";
import {
  constantEqual,
  passwordHash,
  verifyPassword,
} from "../lib/server/security";
import { verifyStripeSignature } from "../lib/server/payments";
describe("Money and checkout rules", () => {
  it("uses integer cents and exact delivery threshold", () => {
    expect(
      calculateTotals([
        { product: { ...catalog[0], price: 1999 }, quantity: 1 },
      ]),
    ).toEqual({
      subtotal: 1999,
      delivery: 299,
      tax: 100,
      discount: 0,
      total: 2398,
    });
    expect(
      calculateTotals([
        { product: { ...catalog[0], price: 2000 }, quantity: 1 },
      ]).delivery,
    ).toBe(0);
  });
  it("handles an empty basket", () =>
    expect(calculateTotals([])).toEqual({
      subtotal: 0,
      delivery: 0,
      tax: 0,
      discount: 0,
      total: 0,
    }));
  it("caps promotional savings and taxes the discounted amount", () => {
    const t = calculateTotals(
      [{ product: { ...catalog[0], price: 15000 }, quantity: 1 }],
      " fresh10 ",
    );
    expect(t).toEqual({
      subtotal: 15000,
      discount: 1000,
      delivery: 0,
      tax: 700,
      total: 14700,
    });
  });
  it("formats currency without losing cents", () =>
    expect(money(299)).toBe("$2.99"));
});
describe("Order state machine", () => {
  it.each([
    ["Placed", "Confirmed", "admin", true],
    ["Confirmed", "Packed", "admin", true],
    ["Packed", "Out for Delivery", "delivery", true],
    ["Out for Delivery", "Delivered", "delivery", true],
    ["Placed", "Delivered", "admin", false],
    ["Delivered", "Cancelled", "customer", false],
    ["Out for Delivery", "Cancelled", "customer", false],
    ["Placed", "Cancelled", "customer", true],
    ["Packed", "Delivered", "delivery", false],
    ["Placed", "Packed", "customer", false],
  ] as const)("%s → %s by %s is %s", (from, to, role, result) =>
    expect(canTransition(from, to, role)).toBe(result),
  );
});
describe("Request validation", () => {
  const address = {
    label: "Home",
    name: "Test Customer",
    phone: "+1 503 555 0100",
    street: "123 Fictional Avenue",
    city: "Portland",
    state: "Oregon",
    zip: "97201",
  };
  it("normalizes emails and strips privilege escalation fields", () => {
    const data = registerSchema.parse({
      name: "Alex",
      email: "  Alex@Example.com ",
      password: "long-password-123",
      role: "admin",
    });
    expect(data.email).toBe("alex@example.com");
    expect(data).not.toHaveProperty("role");
  });
  it("rejects weak passwords, invalid locations and addresses", () => {
    expect(
      registerSchema.safeParse({ name: "A", email: "bad", password: "123" })
        .success,
    ).toBe(false);
    expect(addressSchema.safeParse({ ...address, lat: 100 }).success).toBe(
      false,
    );
    expect(
      addressSchema.safeParse({ ...address, phone: "phone" }).success,
    ).toBe(false);
  });
  it("rejects duplicate, negative and fractional quantities", () => {
    const payload = {
      address,
      payment: "cash",
      idempotencyKey: crypto.randomUUID(),
    };
    expect(
      checkoutSchema.safeParse({
        ...payload,
        items: [
          { productId: "a", quantity: 1 },
          { productId: "a", quantity: 1 },
        ],
      }).success,
    ).toBe(false);
    for (const quantity of [-1, 0, 1.5, 51])
      expect(
        checkoutSchema.safeParse({
          ...payload,
          items: [{ productId: "a", quantity }],
        }).success,
      ).toBe(false);
  });
  it("rejects arbitrary image URLs, script URLs, and negative prices", () => {
    expect(
      productSchema.safeParse({ ...catalog[0], image: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(productSchema.safeParse({ ...catalog[0], price: -1 }).success).toBe(
      false,
    );
    expect(
      productSchema.safeParse({ ...catalog[0], originalPrice: 1 }).success,
    ).toBe(false);
  });
});
describe("Authentication cryptography", () => {
  it("salts hashes and validates correct passwords only", async () => {
    const a = await passwordHash("a-long-password"),
      b = await passwordHash("a-long-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("a-long-password", a)).toBe(true);
    expect(await verifyPassword("wrong-password", a)).toBe(false);
    expect(constantEqual("123456", "12345")).toBe(false);
  });
  it("verifies signed payment webhooks and rejects tampering or replay", async () => {
    const payload = '{"type":"checkout.session.completed"}',
      secret = "test-webhook-secret",
      now = Date.now(),
      t = Math.floor(now / 1000);
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
          new TextEncoder().encode(`${t}.${payload}`),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const h = `t=${t},v1=${signature}`;
    expect(await verifyStripeSignature(payload, h, secret, now)).toBe(true);
    expect(await verifyStripeSignature(payload + " ", h, secret, now)).toBe(
      false,
    );
    expect(await verifyStripeSignature(payload, h, secret, now + 600000)).toBe(
      false,
    );
  });
});
