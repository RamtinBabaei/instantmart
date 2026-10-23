import type { Product, User, Order, OrderItem, OrderEvent } from "../types";
export interface UserRow {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  password: string | null;
  role: User["role"];
  demo: number;
  phone: string;
  active: number;
  vehicle: string;
}
export const publicUser = (u: UserRow): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  demo: !!u.demo,
  phone: u.phone,
  active: !!u.active,
  vehicle: u.vehicle,
});
export interface ProductRow {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  price: number;
  original_price: number;
  unit: string;
  stock: number;
  organic: number;
  active: number;
}
export const publicProduct = (p: ProductRow): Product => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  image: p.image,
  price: p.price,
  originalPrice: p.original_price,
  unit: p.unit,
  stock: p.stock,
  organic: !!p.organic,
  active: !!p.active,
});
export async function getProducts(db: D1Database, scope: string) {
  const r = await db
    .prepare("SELECT * FROM products WHERE workspace_id=? ORDER BY rowid")
    .bind(scope)
    .all<ProductRow>();
  return r.results.map(publicProduct);
}
interface OrderRow {
  id: string;
  workspace_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  address: string;
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  total: number;
  status: Order["status"];
  payment: Order["payment"];
  paid: number;
  partner_id: string | null;
  partner_name: string | null;
  partner_phone: string | null;
  otp: string;
  lat: number | null;
  lng: number | null;
  location_at: number | null;
  created_at: number;
  updated_at: number;
}
export async function getOrders(db: D1Database, u: UserRow, id?: string) {
  let clause = "o.workspace_id=?";
  const params: (string | number)[] = [u.workspace_id];
  if (u.role === "customer") {
    clause += " AND o.user_id=?";
    params.push(u.id);
  }
  if (u.role === "delivery") {
    clause +=
      " AND (o.partner_id=? OR (o.partner_id IS NULL AND o.status='Packed'))";
    params.push(u.id);
  }
  if (id) {
    clause += " AND o.id=?";
    params.push(id);
  }
  const { results } = await db
    .prepare(
      `SELECT o.*,u.name customer_name,u.email customer_email,p.name partner_name,p.phone partner_phone FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN users p ON p.id=o.partner_id WHERE ${clause} ORDER BY o.created_at DESC LIMIT 100`,
    )
    .bind(...params)
    .all<OrderRow>();
  if (!results.length) return [];
  const ids = results.map((r) => r.id),
    marks = ids.map(() => "?").join(",");
  const [items, events] = await db.batch([
    db
      .prepare(
        `SELECT order_id,product_id productId,name,image,unit,price,quantity FROM order_items WHERE order_id IN (${marks})`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT order_id,status,created_at createdAt,note FROM order_events WHERE order_id IN (${marks}) ORDER BY created_at`,
      )
      .bind(...ids),
  ]);
  return results.map((r): Order => ({
    id: r.id,
    userId: r.user_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    address: JSON.parse(r.address),
    subtotal: r.subtotal,
    delivery: r.delivery,
    tax: r.tax,
    discount: r.discount,
    total: r.total,
    status: r.status,
    payment: r.payment,
    paid: !!r.paid,
    partnerId: r.partner_id,
    partnerName: r.partner_name,
    partnerPhone: r.partner_phone,
    ...(u.role === "customer" ? { otp: r.otp } : {}),
    lat: r.lat,
    lng: r.lng,
    locationAt: r.location_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: (items.results as (OrderItem & { order_id: string })[])
      .filter((i) => i.order_id === r.id)
      .map((i) => ({
        productId: i.productId,
        name: i.name,
        image: i.image,
        unit: i.unit,
        price: i.price,
        quantity: i.quantity,
      })),
    events: (events.results as (OrderEvent & { order_id: string })[])
      .filter((i) => i.order_id === r.id)
      .map((i) => ({ status: i.status, createdAt: i.createdAt, note: i.note })),
  }));
}
