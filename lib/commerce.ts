import type { CartItem, Status, Totals } from "./types";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export function calculateTotals(
  items: Pick<CartItem, "product" | "quantity">[],
  coupon = "",
): Totals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const discount =
    coupon.trim().toUpperCase() === "FRESH10"
      ? Math.min(1000, Math.round(subtotal * 0.1))
      : 0;
  const delivery = subtotal === 0 || subtotal >= 2000 ? 0 : 299;
  const tax = Math.round((subtotal - discount) * 0.05);
  return {
    subtotal,
    delivery,
    tax,
    discount,
    total: subtotal + delivery + tax - discount,
  };
}
export const orderSteps: Status[] = [
  "Placed",
  "Confirmed",
  "Packed",
  "Out for Delivery",
  "Delivered",
];
export function canTransition(
  from: Status,
  to: Status,
  role: "admin" | "delivery" | "customer",
) {
  if (to === "Cancelled")
    return (
      role !== "delivery" && ["Placed", "Confirmed", "Packed"].includes(from)
    );
  if (role === "customer") return false;
  if (role === "delivery")
    return (
      (from === "Packed" && to === "Out for Delivery") ||
      (from === "Out for Delivery" && to === "Delivered")
    );
  return (
    (from === "Placed" && to === "Confirmed") ||
    (from === "Confirmed" && to === "Packed")
  );
}
