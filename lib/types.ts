export type Role = "customer" | "admin" | "delivery";
export type Status =
  | "Awaiting payment"
  | "Placed"
  | "Confirmed"
  | "Packed"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  price: number;
  originalPrice: number;
  unit: string;
  stock: number;
  organic: boolean;
  active: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  demo: boolean;
  phone: string;
  active: boolean;
  vehicle: string;
}
export interface Address {
  id?: string;
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number | null;
  lng?: number | null;
}
export interface CartItem {
  product: Product;
  quantity: number;
}
export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  unit: string;
  price: number;
  quantity: number;
}
export interface OrderEvent {
  status: Status;
  createdAt: number;
  note: string;
}
export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  address: Address;
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  total: number;
  status: Status;
  payment: "cash" | "card";
  paid: boolean;
  partnerId: string | null;
  partnerName: string | null;
  partnerPhone: string | null;
  otp?: string;
  lat: number | null;
  lng: number | null;
  locationAt: number | null;
  createdAt: number;
  updatedAt: number;
  items: OrderItem[];
  events: OrderEvent[];
}
export interface Session {
  user: User | null;
  demoEnabled: boolean;
  cardEnabled: boolean;
}
export interface Totals {
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  total: number;
}
