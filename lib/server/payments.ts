import { constantEqual, HttpError } from "./security";
export async function createStripeCheckout(
  secret: string,
  order: { id: string; total: number; email: string },
  origin: string,
) {
  const form = new URLSearchParams({
    expires_at: String(Math.floor(Date.now() / 1000) + 1800),
    mode: "payment",
    customer_email: order.email,
    client_reference_id: order.id,
    "metadata[orderId]": order.id,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `InstantMart order ${order.id.slice(-8).toUpperCase()}`,
    "line_items[0][price_data][unit_amount]": String(order.total),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/orders/${order.id}?payment=success`,
    cancel_url: `${origin}/orders/${order.id}?payment=cancelled`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": order.id,
    },
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  const result = (await response.json()) as { id?: string; url?: string };
  if (!response.ok || !result.id || !result.url)
    throw new HttpError(
      502,
      "The payment provider is unavailable. Your reservation has been cancelled.",
    );
  return { id: result.id, url: result.url };
}
export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  now = Date.now(),
) {
  const pairs = header.split(",").map((s) => s.split("="));
  const timestamp = pairs.find((p) => p[0] === "t")?.[1];
  const signatures = pairs.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`),
    ),
  );
  const expected = Array.from(signed)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signatures.some((s) => constantEqual(s, expected));
}
