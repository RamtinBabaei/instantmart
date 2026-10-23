import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password"),
    role: text("role").notNull().default("customer"),
    phone: text("phone").notNull().default(""),
    vehicle: text("vehicle").notNull().default("bike"),
    active: integer("active").notNull().default(1),
    demo: integer("demo").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("users_email").on(t.workspaceId, t.email),
    index("users_workspace").on(t.workspaceId),
  ],
);
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expiresAt)],
);
export const products = sqliteTable(
  "products",
  {
    workspaceId: text("workspace_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    image: text("image").notNull(),
    price: integer("price").notNull(),
    originalPrice: integer("original_price").notNull(),
    unit: text("unit").notNull(),
    stock: integer("stock").notNull(),
    organic: integer("organic").notNull().default(0),
    active: integer("active").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("products_category").on(t.workspaceId, t.category),
  ],
);
export const addresses = sqliteTable(
  "addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    street: text("street").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    lat: real("lat"),
    lng: real("lng"),
  },
  (t) => [index("addresses_user").on(t.userId)],
);
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    address: text("address").notNull(),
    subtotal: integer("subtotal").notNull(),
    delivery: integer("delivery").notNull(),
    tax: integer("tax").notNull(),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    status: text("status").notNull().default("Placed"),
    payment: text("payment").notNull().default("cash"),
    paid: integer("paid").notNull().default(0),
    partnerId: text("partner_id").references(() => users.id),
    otp: text("otp").notNull(),
    lat: real("lat"),
    lng: real("lng"),
    locationAt: integer("location_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    paymentSession: text("payment_session"),
  },
  (t) => [
    index("orders_workspace_status").on(t.workspaceId, t.status),
    index("orders_user").on(t.userId, t.createdAt),
    uniqueIndex("orders_idempotency").on(t.userId, t.idempotencyKey),
  ],
);
export const orderItems = sqliteTable(
  "order_items",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    image: text("image").notNull(),
    unit: text("unit").notNull(),
    price: integer("price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);
export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [index("events_order").on(t.orderId, t.createdAt)],
);
export const subscriptions = sqliteTable("subscriptions", {
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
