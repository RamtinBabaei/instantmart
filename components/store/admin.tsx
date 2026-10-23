"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  DollarSign,
  Edit3,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import { useStore } from "./provider";
import { RoleGate, useOrders } from "./customer";
import { Badge, Empty, ErrorMessage, Loading, Modal } from "./ui";
import { api } from "@/lib/client";
import { catalog, categories } from "@/lib/catalog";
import { money } from "@/lib/commerce";
import type { Order, Product, Status, User } from "@/lib/types";
const sections = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/products", "Products", Package],
  ["/admin/orders", "Orders", ShoppingBag],
  ["/admin/partners", "Delivery team", Truck],
] as const;
export default function Admin() {
  return (
    <RoleGate role="admin">
      <AdminWorkspace />
    </RoleGate>
  );
}
function AdminWorkspace() {
  const path = usePathname(),
    { session } = useStore();
  return (
    <main className="workspace container">
      <aside className="workspace-nav">
        <span className="eyebrow">BEHIND THE BASKET</span>
        <h2>
          Store studio<span>MANAGEMENT</span>
        </h2>
        <nav aria-label="Store management">
          {sections.map(([href, label, I]) => (
            <Link
              href={href}
              key={href}
              className={path === href ? "selected" : ""}
            >
              <I size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-note">
          <span className="live-dot" />{" "}
          {session.user?.demo ? "Your isolated demo store" : "Store connected"}
          <p>Every little detail makes a difference.</p>
          <Link href="/products">
            View your storefront <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
      <section className="workspace-main">
        {path === "/admin/products" ? (
          <AdminProducts />
        ) : path === "/admin/orders" ? (
          <AdminOrders />
        ) : path === "/admin/partners" ? (
          <AdminPartners />
        ) : (
          <Overview />
        )}
      </section>
    </main>
  );
}
function Overview() {
  const { orders, loading, error } = useOrders("/admin/orders");
  const [stats, setStats] = useState<{
    orders: number;
    revenue: number;
    products: number;
    lowStock: number;
  } | null>(null);
  useEffect(() => {
    api<{
      orders: number;
      revenue: number;
      products: number;
      lowStock: number;
    }>("/admin/stats")
      .then(setStats)
      .catch(() => {});
  }, [orders]);
  const cards = [
    ["Orders", stats?.orders ?? "—", ShoppingBag],
    ["Delivered revenue", stats ? money(stats.revenue) : "—", DollarSign],
    ["Active products", stats?.products ?? "—", Package],
    ["Low stock", stats?.lowStock ?? "—", BarChart3],
  ] as const;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">A FRESH PERSPECTIVE</span>
          <h1>Your store, at a glance.</h1>
          <p>A little overview of what’s happening today.</p>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="stat-grid">
        {cards.map(([label, value, I]) => (
          <article key={label}>
            <span>
              <I size={19} />
            </span>
            <small>{label}</small>
            <b>{value}</b>
          </article>
        ))}
      </div>
      <div className="data-panel">
        <header>
          <h2>The latest baskets.</h2>
          <Link href="/admin/orders" className="text-link">
            All orders <ArrowRight size={15} />
          </Link>
        </header>
        {loading ? (
          <Loading />
        ) : orders.length ? (
          <OrderTable orders={orders.slice(0, 6)} />
        ) : (
          <Empty
            title="Ready for your first order."
            description="Shop as a customer in this demo workspace, then return here to manage the order."
          />
        )}
      </div>
      <div className="dashboard-note">
        <LeafGraphic />
        <div>
          <h3>Good inventory. Great experiences.</h3>
          <p>
            Keep your shelves current, confirm new orders, and help every basket
            find its way home.
          </p>
        </div>
        <Link href="/admin/products" className="text-link">
          Manage products <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
function LeafGraphic() {
  return <Package size={31} strokeWidth={1.3} />;
}
function OrderTable({
  orders,
  actions,
}: {
  orders: Order[];
  actions?: (o: Order) => React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            {actions && <th>Next step</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <b>#{o.id.slice(-8).toUpperCase()}</b>
                <small>{new Date(o.createdAt).toLocaleDateString()}</small>
              </td>
              <td>
                <b>{o.customerName}</b>
                <small>{o.customerEmail}</small>
              </td>
              <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td>{money(o.total)}</td>
              <td>
                <Badge status={o.status} />
              </td>
              {actions && <td>{actions(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AdminOrders() {
  const { orders, loading, error, reload } = useOrders("/admin/orders"),
    { toast } = useStore();
  const [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState<Order | null>(null),
    [partners, setPartners] = useState<User[]>([]),
    [partner, setPartner] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ partners: User[] }>("/admin/partners")
      .then((r) => setPartners(r.partners))
      .catch(() => {});
  }, []);
  async function change(o: Order, status: Status) {
    setBusy(true);
    try {
      await api("/admin/orders/" + o.id, "PATCH", {
        status,
        ...(partner && status === "Packed" ? { partnerId: partner } : {}),
      });
      setSelected(null);
      setPartner("");
      await reload();
      toast("Order updated.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const list = orders.filter((o) => filter === "All" || o.status === filter);
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">EVERY BASKET MATTERS</span>
          <h1>Keep the goodness moving.</h1>
          <p>Confirm, pack, and prepare each order for delivery.</p>
        </div>
        <button className="button button-outline" onClick={() => void reload()}>
          Refresh
        </button>
      </div>
      <div className="filter-tabs">
        {[
          "All",
          "Placed",
          "Confirmed",
          "Packed",
          "Out for Delivery",
          "Delivered",
          "Cancelled",
        ].map((s) => (
          <button
            key={s}
            className={s === filter ? "selected" : ""}
            onClick={() => setFilter(s)}
          >
            {s}
            <span>
              {orders.filter((o) => s === "All" || o.status === s).length}
            </span>
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      <div className="data-panel">
        {loading ? (
          <Loading />
        ) : list.length ? (
          <OrderTable
            orders={list}
            actions={(o) => (
              <button
                className="text-link"
                onClick={() => {
                  setSelected(o);
                  setPartner(o.partnerId ?? "");
                }}
              >
                Manage <ArrowRight size={13} />
              </button>
            )}
          />
        ) : (
          <Empty
            title="All quiet in this aisle."
            description="Orders matching this status will appear here."
          />
        )}
      </div>
      {selected && (
        <Modal
          wide
          title={"Order #" + selected.id.slice(-8).toUpperCase()}
          onClose={() => setSelected(null)}
        >
          <div className="admin-order-info">
            <Badge status={selected.status} />
            <h3>{selected.customerName}</h3>
            <p>
              {selected.address.street}, {selected.address.city}
              <br />
              {selected.address.phone}
            </p>
            <div className="review-items">
              {selected.items.map((i) => (
                <div key={i.productId}>
                  <img src={i.image} alt="" width={45} height={45} />
                  <span>
                    {i.name}
                    <small>
                      {i.quantity} × {money(i.price)}
                    </small>
                  </span>
                  <b>{money(i.quantity * i.price)}</b>
                </div>
              ))}
            </div>
            <div className="admin-order-total">
              <b>Total {money(selected.total)}</b>
              <span>
                {selected.payment === "cash" ? "Cash on delivery" : "Card"} ·{" "}
                {selected.paid ? "Paid" : "Unpaid"}
              </span>
            </div>
            {selected.status === "Confirmed" && (
              <label className="form-stack">
                Delivery partner (optional)
                <select
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                >
                  <option value="">Any available delivery partner</option>
                  {partners
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="step-actions">
              {["Placed", "Confirmed", "Packed"].includes(selected.status) &&
                !selected.paid && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => void change(selected, "Cancelled")}
                  >
                    Cancel order
                  </button>
                )}
              {selected.status === "Placed" && (
                <button
                  className="button button-green"
                  disabled={busy}
                  onClick={() => void change(selected, "Confirmed")}
                >
                  Confirm order <Check size={16} />
                </button>
              )}
              {selected.status === "Confirmed" && (
                <button
                  className="button button-green"
                  disabled={busy}
                  onClick={() => void change(selected, "Packed")}
                >
                  Mark as packed <Package size={16} />
                </button>
              )}
              {selected.status === "Packed" && (
                <p className="tiny-text">
                  Your delivery partner can now accept and start this delivery.
                </p>
              )}
              {selected.status === "Out for Delivery" && (
                <p className="tiny-text">
                  Completion requires the customer’s code in the delivery
                  dashboard.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function AdminProducts() {
  const { toast, reload } = useStore();
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const load = useCallback(async () => {
    try {
      const r = await api<{ products: Product[] }>("/admin/products");
      setProducts(r.products);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Data loading updates state only after the awaited request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function archive(p: Product) {
    try {
      await api("/admin/products/" + p.id, "PUT", { ...p, active: !p.active });
      await load();
      await reload();
      toast(
        p.active
          ? "Product taken off the shelf."
          : "Product is back on the shelf.",
      );
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">A WELL-STOCKED LITTLE STORE</span>
          <h1>Your shelves, thoughtfully filled.</h1>
          <p>
            {products.filter((p) => p.active).length} live products · prices in
            USD
          </p>
        </div>
        <button
          className="button button-green"
          onClick={() => setEditing(null)}
        >
          <Plus size={17} /> Add product
        </button>
      </div>
      <div className="admin-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search inventory"
          placeholder="Find a product on your shelves…"
        />
      </div>
      <ErrorMessage message={error} />
      <div className="data-panel">
        {loading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) =>
                    p.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          <img src={p.image} alt="" width={48} height={48} />
                          <span>
                            <b>{p.name}</b>
                            <small>
                              {
                                categories.find((c) => c.id === p.category)
                                  ?.name
                              }
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>{money(p.price)}</td>
                      <td>
                        <span className={p.stock <= 10 ? "low-stock" : ""}>
                          {p.stock} available
                        </span>
                      </td>
                      <td>
                        <Badge status={p.active ? "Live" : "Archived"} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => setEditing(p)}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`${p.active ? "Archive" : "Restore"} ${p.name}`}
                            onClick={() => void archive(p)}
                          >
                            {p.active ? (
                              <Trash2 size={16} />
                            ) : (
                              <Plus size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing !== undefined && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
            await reload();
          }}
        />
      )}
    </>
  );
}
function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useStore();
  const [image, setImage] = useState(product?.image ?? catalog[0].image),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    if (file.size > 2097152) {
      setError("Choose an image under 2 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const r = (await response.json()) as { image: string; error?: string };
      if (!response.ok) throw new Error(r.error);
      setImage(r.image);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      await api(
        "/admin/products" + (product ? "/" + product.id : ""),
        product ? "PUT" : "POST",
        {
          name: f.get("name"),
          description: f.get("description"),
          category: f.get("category"),
          unit: f.get("unit"),
          price: Math.round(Number(f.get("price")) * 100),
          originalPrice: Math.round(Number(f.get("originalPrice")) * 100),
          stock: Number(f.get("stock")),
          organic: f.get("organic") === "on",
          active: f.get("active") === "on",
          image,
        },
      );
      await onSaved();
      toast("Product saved. Your shelf is up to date.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={
        product ? "A little product update." : "Something new for the shelf."
      }
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="product-editor-image">
          <img src={image} alt="Product preview" width={100} height={100} />
          <div>
            <label className="upload-button">
              <Upload size={16} />
              {uploading ? "Uploading…" : "Upload a product image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
            <span className="tiny-text">PNG, JPEG or WebP · up to 2 MB</span>
          </div>
        </div>
        <div className="form-grid">
          <label className="field-full">
            Product name
            <input
              name="name"
              defaultValue={product?.name}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="field-full">
            Description
            <textarea
              name="description"
              defaultValue={product?.description}
              required
              minLength={5}
              maxLength={2000}
              rows={3}
            />
          </label>
          <label>
            Category
            <select
              name="category"
              defaultValue={product?.category ?? categories[0].id}
            >
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unit
            <input
              name="unit"
              defaultValue={product?.unit ?? "1 kg"}
              required
              maxLength={30}
            />
          </label>
          <label>
            Price ($)
            <input
              type="number"
              name="price"
              min="0.01"
              max="10000"
              step="0.01"
              defaultValue={(product?.price ?? 299) / 100}
              required
            />
          </label>
          <label>
            Original price ($)
            <input
              type="number"
              name="originalPrice"
              min="0.01"
              max="10000"
              step="0.01"
              defaultValue={(product?.originalPrice ?? 399) / 100}
              required
            />
          </label>
          <label>
            Stock quantity
            <input
              type="number"
              name="stock"
              min="0"
              max="100000"
              step="1"
              defaultValue={product?.stock ?? 50}
              required
            />
          </label>
          <label>
            Or use a catalog image
            <select value={image} onChange={(e) => setImage(e.target.value)}>
              {!catalog.some((p) => p.image === image) && (
                <option value={image}>Uploaded image</option>
              )}
              {catalog.map((p) => (
                <option value={p.image} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              name="organic"
              defaultChecked={product?.organic}
            />{" "}
            Organically grown
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
            />{" "}
            Visible in the store
          </label>
        </div>
        <ErrorMessage message={error} />
        <button disabled={busy || uploading} className="button button-green">
          {busy ? "Saving…" : "Save product"}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function AdminPartners() {
  const { toast } = useStore();
  const [partners, setPartners] = useState<User[]>([]),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      api<{ partners: User[] }>("/admin/partners")
        .then((r) => setPartners(r.partners))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    // Data loading updates state only after the awaited request completes.

    void load();
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/partners",
        "POST",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      setOpen(false);
      await load();
      toast("A new delivery partner is on the team.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p: User) {
    try {
      await api("/admin/partners/" + p.id, "PATCH", { active: !p.active });
      await load();
      toast("Delivery partner updated.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE DOORSTEP</span>
          <h1>Your delivery team.</h1>
          <p>
            {partners.filter((p) => p.active).length} active partners bringing
            goodness home.
          </p>
        </div>
        <button className="button button-green" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add partner
        </button>
      </div>
      <ErrorMessage message={error} />
      <div className="partner-grid">
        {partners.map((p) => (
          <article className="team-card" key={p.id}>
            <div className="team-card-top">
              <span className="avatar">{p.name[0]}</span>
              <Badge status={p.active ? "Active" : "Inactive"} />
            </div>
            <h2>{p.name}</h2>
            <p>{p.email}</p>
            <p>{p.phone}</p>
            <span className="vehicle-tag">
              <Truck size={16} /> {p.vehicle}
            </span>
            <button
              className="button button-outline w-full"
              onClick={() => void toggle(p)}
            >
              {p.active ? "Set as inactive" : "Activate partner"}
            </button>
          </article>
        ))}
      </div>
      {open && (
        <Modal title="A new face on the team." onClose={() => setOpen(false)}>
          <form className="form-stack" onSubmit={create}>
            {[
              ["name", "Full name", "text"],
              ["email", "Email address", "email"],
              ["phone", "Phone number", "tel"],
              ["password", "Temporary password", "password"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input
                  type={type}
                  name={name}
                  required
                  minLength={name === "password" ? 10 : 2}
                  maxLength={name === "email" ? 254 : 128}
                  autoComplete={name === "password" ? "new-password" : name}
                />
              </label>
            ))}
            <label>
              Vehicle
              <select name="vehicle">
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
              </select>
            </label>
            <ErrorMessage message={error} />
            <button className="button button-green" disabled={busy}>
              {busy ? "Adding…" : "Add delivery partner"}
              <Users size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
