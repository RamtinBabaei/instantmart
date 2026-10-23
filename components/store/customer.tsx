"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Leaf,
  LocateFixed,
  LogOut,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useStore } from "./provider";
import { AuthForm } from "./auth";
import { Badge, Empty, ErrorMessage, Loading, Modal, Quantity } from "./ui";
import { api, createRequestId } from "@/lib/client";
import {
  calculateTotals,
  canTransition,
  money,
  orderSteps,
} from "@/lib/commerce";
import type { Address, Order, Role, Totals } from "@/lib/types";
export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { session, ready } = useStore();
  if (!ready) return <Loading />;
  if (session.user?.role !== role)
    return (
      <main className="container role-gate">
        <div className="role-gate-copy">
          <span className="eyebrow">
            {role === "admin"
              ? "BEHIND THE BASKET"
              : role === "delivery"
                ? "DELIVER A LITTLE GOODNESS"
                : "YOUR EVERYDAY ACCOUNT"}
          </span>
          <h1>
            {role === "admin"
              ? "A good day starts with a well-run store."
              : role === "delivery"
                ? "The freshest part of someone’s day."
                : "Make yourself at home."}
          </h1>
          <p>
            {role === "customer"
              ? "Manage your details, saved addresses, and all the goodness on its way."
              : `Explore the ${role === "admin" ? "inventory, order management, and delivery team" : "delivery queue, location sharing, and secure handoff"} in your own demo workspace.`}
          </p>
          <span className="role-gate-visual">
            <Leaf size={80} strokeWidth={1} />
          </span>
        </div>
        <div className="role-auth-card">
          <AuthForm role={role} />
        </div>
      </main>
    );
  return children;
}
export function TotalsCard({
  totals,
  children,
}: {
  totals: Totals;
  children?: ReactNode;
}) {
  return (
    <aside className="summary-card">
      <h2>Your basket, at a glance.</h2>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{money(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 && (
          <div className="saving">
            <dt>Promo savings</dt>
            <dd>−{money(totals.discount)}</dd>
          </div>
        )}
        <div>
          <dt>Delivery</dt>
          <dd>
            {totals.delivery ? (
              money(totals.delivery)
            ) : (
              <span className="saving">On us</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Tax (5%)</dt>
          <dd>{money(totals.tax)}</dd>
        </div>
        <div className="summary-total">
          <dt>Total</dt>
          <dd>{money(totals.total)}</dd>
        </div>
      </dl>
      {children}
      <p className="secure-note">
        <ShieldCheck size={14} /> Carefully picked. Securely checked out.
      </p>
    </aside>
  );
}
export function Cart() {
  const { cart, quantity } = useStore(),
    totals = calculateTotals(cart);
  return (
    <main className="container page-content">
      <div className="breadcrumbs">
        <Link href="/products">
          <ArrowLeft size={13} /> Keep shopping
        </Link>
      </div>
      <div className="page-intro">
        <div>
          <span className="eyebrow">GOOD THINGS, ALL IN ONE PLACE</span>
          <h1>Your little basket of goodness.</h1>
          <p>
            {cart.reduce((s, i) => s + i.quantity, 0)} fresh finds, ready for
            your day.
          </p>
        </div>
      </div>
      {!cart.length ? (
        <Empty
          title="Room for a little goodness."
          description="Your basket is empty. Let’s find something fresh to bring home."
        >
          <Link href="/products" className="button button-green">
            Explore the aisles <ArrowRight size={17} />
          </Link>
        </Empty>
      ) : (
        <div className="checkout-layout">
          <div>
            <div className="free-delivery-note">
              <Truck size={20} />
              {totals.subtotal >= 2000
                ? "Good news! Your delivery is on us."
                : `You’re ${money(2000 - totals.subtotal)} away from free delivery.`}
              <div>
                <span
                  style={{ width: `${Math.min(100, totals.subtotal / 20)}%` }}
                />
              </div>
            </div>
            <div className="cart-items">
              {cart.map((i) => (
                <article className="cart-item" key={i.product.id}>
                  <Link href={`/products/${i.product.id}`}>
                    <img
                      src={i.product.image}
                      width={110}
                      height={110}
                      alt={i.product.name}
                    />
                  </Link>
                  <div className="cart-item-name">
                    <span className="product-unit">{i.product.unit}</span>
                    <h2>
                      <Link href={`/products/${i.product.id}`}>
                        {i.product.name}
                      </Link>
                    </h2>
                    <span>{money(i.product.price)} each</span>
                  </div>
                  <Quantity
                    id={i.product.name}
                    value={i.quantity}
                    onChange={(n) => quantity(i.product.id, n)}
                  />
                  <strong>{money(i.product.price * i.quantity)}</strong>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${i.product.name} from cart`}
                    onClick={() => quantity(i.product.id, 0)}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
            </div>
            <div className="basket-care">
              <Leaf size={20} />
              <p>
                A little care goes into every basket. We choose your groceries
                as thoughtfully as you would.
              </p>
            </div>
          </div>
          <TotalsCard totals={totals}>
            <Link href="/checkout" className="button button-green w-full">
              Continue to checkout <ArrowRight size={17} />
            </Link>
            <Link href="/products" className="summary-back">
              A little more shopping
            </Link>
          </TotalsCard>
        </div>
      )}
    </main>
  );
}
const blankAddress: Address = {
  label: "Home",
  name: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  lat: null,
  lng: null,
};
export function AddressFields({
  value,
  onChange,
  demo = false,
}: {
  value: Address;
  onChange: (a: Address) => void;
  demo?: boolean;
}) {
  const { toast } = useStore();
  function locate() {
    if (!navigator.geolocation) {
      toast("Location sharing is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        onChange({ ...value, lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        toast(
          "Location was not shared. You can enter your address without it.",
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  return (
    <>
      <div className="form-grid">
        {(
          [
            ["name", "Full name", "name"],
            ["phone", "Phone number", "tel"],
            ["street", "Street address", "street-address"],
            ["city", "City", "address-level2"],
            ["state", "State / region", "address-level1"],
            ["zip", "ZIP / postal code", "postal-code"],
          ] as const
        ).map(([name, label, autocomplete]) => (
          <label className={name === "street" ? "field-full" : ""} key={name}>
            {label}
            <input
              name={name}
              autoComplete={autocomplete}
              type={name === "phone" ? "tel" : "text"}
              required
              maxLength={name === "street" ? 200 : 80}
              minLength={name === "phone" ? 7 : name === "zip" ? 3 : 2}
              value={value[name]}
              onChange={(e) => onChange({ ...value, [name]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Save as
          <select
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
          >
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <div className="address-actions">
        <button type="button" className="text-link" onClick={locate}>
          <LocateFixed size={15} />
          {value.lat != null
            ? "Location added"
            : "Add my location for tracking"}
        </button>
        {demo && (
          <button
            type="button"
            className="text-link"
            onClick={() =>
              onChange({
                label: "Home",
                name: "Alex Morgan",
                phone: "+1 503 555 0142",
                street: "123 Demo Lane, Apartment 4",
                city: "Portland",
                state: "Oregon",
                zip: "97201",
                lat: 45.5152,
                lng: -122.6784,
              })
            }
          >
            Use fictional demo address
          </button>
        )}
      </div>
      <p className="tiny-text">
        Location is optional. It is shared only with your store and assigned
        delivery partner.
      </p>
    </>
  );
}
export function Checkout() {
  return (
    <RoleGate role="customer">
      <CheckoutForm />
    </RoleGate>
  );
}
function CheckoutForm() {
  const { cart, clear, session, toast, reload } = useStore(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [address, setAddress] = useState<Address>(blankAddress),
    [saved, setSaved] = useState<Address[]>([]),
    [payment, setPayment] = useState<"cash" | "card">("cash"),
    [coupon, setCoupon] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef("");
  useEffect(() => {
    api<{ addresses: Address[] }>("/addresses")
      .then((r) => setSaved(r.addresses))
      .catch(() => {});
    key.current = createRequestId();
  }, []);
  const totals = calculateTotals(cart, coupon);
  function applyPromo(value: string) {
    const entered = value.trim().toUpperCase();
    if (entered !== "FRESH10") {
      toast("That code isn’t valid. Try FRESH10.");
      return;
    }
    setCode(entered);
    setCoupon(entered);
    toast("Your 10% saving is in the bag.");
  }
  async function place() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ order: Order; checkoutUrl?: string }>(
        "/orders",
        "POST",
        {
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
          address,
          payment,
          coupon,
          idempotencyKey: key.current,
        },
      );
      clear();
      await reload();
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      toast("A little goodness is on its way. Order placed!");
      router.push("/orders/" + result.order.id);
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  if (!cart.length)
    return (
      <main className="container">
        <Empty
          title="Let’s start with something fresh."
          description="Add a few groceries to your basket before checking out."
        >
          <Link href="/products" className="button button-green">
            Go shopping
          </Link>
        </Empty>
      </main>
    );
  return (
    <main className="container page-content">
      <div className="breadcrumbs">
        <Link href="/cart">
          <ArrowLeft size={13} /> Your basket
        </Link>
        <span>/</span>
        <span>Checkout</span>
      </div>
      <div className="page-intro">
        <div>
          <span className="eyebrow">ALMOST AT YOUR DOOR</span>
          <h1>A few little details.</h1>
          <p>We’ll take care of the rest.</p>
        </div>
      </div>
      <div className="checkout-steps">
        {["Delivery details", "Payment", "Review & place order"].map((s, i) => (
          <span className={step >= i ? "complete" : ""} key={s}>
            <b>{step > i ? <Check size={14} /> : i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <div className="checkout-layout">
        <section className="checkout-panel">
          {step === 0 ? (
            <>
              <h2>
                <MapPin size={21} /> Where should we bring your goodness?
              </h2>
              {saved.length > 0 && (
                <div className="saved-addresses">
                  {saved.map((a) => (
                    <button
                      key={a.id}
                      className={address.id === a.id ? "selected" : ""}
                      onClick={() => setAddress(a)}
                    >
                      <b>{a.label}</b>
                      <span>
                        {a.street}, {a.city}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(1);
                  setError("");
                }}
              >
                <AddressFields
                  value={address}
                  onChange={setAddress}
                  demo={session.user?.demo}
                />
                <button className="button button-green" type="submit">
                  Continue to payment <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : step === 1 ? (
            <>
              <h2>
                <Wallet size={21} /> Simple, secure payment.
              </h2>
              <label
                className={`payment-option ${payment === "cash" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "cash"}
                  onChange={() => setPayment("cash")}
                />
                <Wallet size={24} />
                <span>
                  <b>Cash on delivery</b>
                  <small>
                    Pay your delivery partner when your order arrives.
                  </small>
                </span>
              </label>
              <label
                className={`payment-option ${!session.cardEnabled || session.user?.demo ? "disabled" : ""} ${payment === "card" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "card"}
                  disabled={!session.cardEnabled || session.user?.demo}
                  onChange={() => setPayment("card")}
                />
                <CreditCard size={24} />
                <span>
                  <b>Credit / debit card</b>
                  <small>
                    {session.cardEnabled && !session.user?.demo
                      ? "Continue securely with Stripe Checkout."
                      : "Unavailable in this demo. Choose cash on delivery."}
                  </small>
                </span>
              </label>
              <div className="step-actions">
                <button className="text-link" onClick={() => setStep(0)}>
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className="button button-green"
                  onClick={() => setStep(2)}
                >
                  Review your order <ArrowRight size={17} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>
                <CheckCircle2 size={21} /> Looking good?
              </h2>
              <div className="review-address">
                <MapPin size={21} />
                <div>
                  <b>
                    {address.name} · {address.label}
                  </b>
                  <p>
                    {address.street}
                    <br />
                    {address.city}, {address.state} {address.zip}
                    <br />
                    {address.phone}
                  </p>
                </div>
                <button className="text-link" onClick={() => setStep(0)}>
                  Edit
                </button>
              </div>
              <div className="review-payment">
                <Wallet size={19} />
                <span>
                  {payment === "cash"
                    ? "Cash on delivery"
                    : "Secure card payment via Stripe"}
                </span>
                <button className="text-link" onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <div className="review-items">
                {cart.map((i) => (
                  <div key={i.product.id}>
                    <img src={i.product.image} alt="" width={52} height={52} />
                    <span>
                      {i.product.name}
                      <small>Quantity: {i.quantity}</small>
                    </span>
                    <b>{money(i.product.price * i.quantity)}</b>
                  </div>
                ))}
              </div>
              <p className="tiny-text">
                By placing your order, you agree to our{" "}
                <Link href="/terms">terms</Link>.{" "}
                {session.user?.demo
                  ? "This is a portfolio demo. No goods will be dispatched and no money will be collected."
                  : "Delivery availability is confirmed by the store."}
              </p>
            </>
          )}
          <ErrorMessage message={error} />
        </section>
        <TotalsCard totals={totals}>
          <div className="promo-form">
            <input
              value={code}
              name="coupon"
              aria-label="Promo code"
              placeholder="A little promo code?"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyPromo(e.currentTarget.value);
                }
              }}
              maxLength={30}
            />
            <button type="button" onClick={() => applyPromo(code)}>
              Apply
            </button>
          </div>
          {coupon && (
            <span className="applied-code">
              <Check size={13} /> FRESH10 applied
              <button
                onClick={() => {
                  setCoupon("");
                  setCode("");
                }}
              >
                Remove
              </button>
            </span>
          )}
          {step === 2 && (
            <button
              className="button button-orange w-full"
              disabled={busy}
              onClick={place}
            >
              {busy
                ? "Placing your order…"
                : payment === "cash"
                  ? "Place your order"
                  : "Continue to Stripe"}
              <ArrowRight size={17} />
            </button>
          )}
          <p className="tiny-text">
            Freshness and availability are checked again when you place your
            order.
          </p>
        </TotalsCard>
      </div>
    </main>
  );
}
export function useOrders(endpoint: string) {
  const [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<{ orders?: Order[]; order?: Order }>(endpoint);
      setOrders(result.orders ?? (result.order ? [result.order] : []));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    // Data loading updates state only after the awaited request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [load]);
  return { orders, loading, error, reload: load };
}
export function Orders({ id }: { id?: string }) {
  return (
    <RoleGate role="customer">
      <CustomerOrders id={id} />
    </RoleGate>
  );
}
function CustomerOrders({ id }: { id?: string }) {
  const { orders, loading, error, reload } = useOrders(
      id ? "/orders/" + id : "/orders",
    ),
    { toast } = useStore();
  const [cancel, setCancel] = useState<Order | null>(null),
    [busy, setBusy] = useState(false);
  const order = orders.find((o) => o.id === id);
  async function confirmCancel() {
    if (!cancel) return;
    setBusy(true);
    try {
      await api(`/orders/${cancel.id}/cancel`, "POST", {});
      setCancel(null);
      toast("Order cancelled. Your items are back on the shelf.");
      await reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container page-content">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/orders">Your orders</Link>
        {id && (
          <>
            <span>/</span>
            <span>Live tracking</span>
          </>
        )}
      </div>
      <div className="page-intro">
        <div>
          <span className="eyebrow">FROM OUR SHELVES TO YOUR DOOR</span>
          <h1>
            {id ? "Your goodness, on its way." : "Every basket has a story."}
          </h1>
          <p>
            {id
              ? "Follow your order from the first pick to the final doorstep."
              : "Your orders, all in one little place."}
          </p>
        </div>
        <button className="button button-outline" onClick={() => void reload()}>
          Refresh orders
        </button>
      </div>
      <ErrorMessage message={error} />
      {loading ? (
        <Loading />
      ) : id ? (
        order ? (
          <>
            <Tracking order={order} />
            <div className="order-detail-bottom">
              <OrderCard order={order} onCancel={() => setCancel(order)} />
              <TotalsCard totals={order} />
            </div>
          </>
        ) : (
          <Empty
            title="We couldn’t find this order."
            description="Check your order history for the latest details."
          >
            <Link href="/orders" className="button button-green">
              See your orders
            </Link>
          </Empty>
        )
      ) : orders.length ? (
        <div className="orders-list">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onCancel={() => setCancel(o)} />
          ))}
        </div>
      ) : (
        <Empty
          title="Your first fresh delivery awaits."
          description="Once you place an order, you can follow every little step right here."
        >
          <Link href="/products" className="button button-green">
            Find something fresh <ArrowRight size={17} />
          </Link>
        </Empty>
      )}
      {cancel && (
        <Modal title="Cancel this order?" onClose={() => setCancel(null)}>
          <p>
            We’ll cancel order #{cancel.id.slice(-8).toUpperCase()} and return
            the reserved items to inventory.
          </p>
          <div className="step-actions">
            <button
              className="button button-outline"
              onClick={() => setCancel(null)}
            >
              Keep my order
            </button>
            <button
              disabled={busy}
              className="button button-danger"
              onClick={confirmCancel}
            >
              {busy ? "Cancelling…" : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
export function OrderCard({
  order: o,
  onCancel,
}: {
  order: Order;
  onCancel?: () => void;
}) {
  return (
    <article className="order-card">
      <header>
        <div>
          <span className="eyebrow">ORDER #{o.id.slice(-8).toUpperCase()}</span>
          <p>
            {new Date(o.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <Badge status={o.status} />
      </header>
      <div className="order-thumbnails">
        {o.items.slice(0, 5).map((i) => (
          <img
            src={i.image}
            alt={i.name}
            width={65}
            height={65}
            key={i.productId}
          />
        ))}
        <span>
          {o.items.reduce((s, i) => s + i.quantity, 0)} items{" "}
          <b>{money(o.total)}</b>
        </span>
      </div>
      <div className="order-card-address">
        <MapPin size={15} />
        <span>
          {o.address.street}, {o.address.city}
        </span>
      </div>
      <footer>
        <span>
          {o.payment === "cash" ? "Cash on delivery" : "Card payment"} ·{" "}
          {o.paid ? "Paid" : "Payment pending"}
        </span>
        <div>
          {onCancel &&
            canTransition(o.status, "Cancelled", "customer") &&
            !o.paid && (
              <button className="text-link muted" onClick={onCancel}>
                Cancel order
              </button>
            )}
          <Link href={`/orders/${o.id}`} className="text-link">
            View order <ArrowRight size={15} />
          </Link>
        </div>
      </footer>
    </article>
  );
}
export function Tracking({ order: o }: { order: Order }) {
  const step = orderSteps.indexOf(o.status);
  const lat = o.lat ?? o.address.lat,
    lng = o.lng ?? o.address.lng;
  return (
    <section className="tracking-panel">
      <div className="tracking-heading">
        <span className="tracking-icon">
          {o.status === "Delivered" ? (
            <CheckCircle2 size={29} />
          ) : (
            <Truck size={29} />
          )}
        </span>
        <div>
          <h2>
            {o.status === "Delivered"
              ? "A little goodness, delivered."
              : o.status === "Cancelled"
                ? "This order was cancelled."
                : o.status === "Out for Delivery"
                  ? "One fresh delivery, headed your way."
                  : o.status === "Awaiting payment"
                    ? "Waiting for payment confirmation."
                    : "We’re getting your basket ready."}
          </h2>
          <p>
            {o.status === "Out for Delivery"
              ? `Your delivery partner${o.partnerName ? " " + o.partnerName : ""} is on the way.`
              : o.status === "Delivered"
                ? "Enjoy your fresh finds. Thanks for shopping with us."
                : "You’ll see each update from the store right here."}
          </p>
        </div>
        <Badge status={o.status} />
      </div>
      {o.status !== "Cancelled" && o.status !== "Awaiting payment" && (
        <ol className="tracking-steps">
          {orderSteps.map((status, i) => (
            <li className={step >= i ? "done" : ""} key={status}>
              <span>{step >= i ? <Check size={17} /> : i + 1}</span>
              <b>{status}</b>
              <small>
                {o.events.find((e) => e.status === status)
                  ? new Date(
                      o.events.find((e) => e.status === status)!.createdAt,
                    ).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Coming up"}
              </small>
            </li>
          ))}
        </ol>
      )}
      <div className="tracking-grid">
        <div className="live-map">
          {lat != null && lng != null ? (
            <iframe
              title="Order delivery location on OpenStreetMap"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.013}%2C${lat - 0.007}%2C${lng + 0.013}%2C${lat + 0.007}&layer=mapnik&marker=${lat}%2C${lng}`}
            />
          ) : (
            <div className="map-waiting">
              <MapPin size={34} />
              <b>Goodness is getting closer.</b>
              <p>The map will appear when a delivery location is shared.</p>
            </div>
          )}
          <span className="map-label">
            <span className={o.locationAt ? "live-dot" : ""} />
            {o.locationAt
              ? `Partner location · updated ${new Date(o.locationAt).toLocaleTimeString()}`
              : lat != null
                ? "Your delivery destination"
                : "Waiting for a location update"}
          </span>
        </div>
        <div className="handoff-card">
          <h3>
            <ShieldCheck size={19} /> A safe little handoff.
          </h3>
          <p>
            Share this code with your delivery partner only after your groceries
            arrive.
          </p>
          <strong className="delivery-code">{o.otp ?? "••••••"}</strong>
          {o.partnerName && (
            <div className="partner-info">
              <span className="avatar">{o.partnerName[0]}</span>
              <div>
                <b>{o.partnerName}</b>
                <small>Your delivery partner</small>
              </div>
              {o.partnerPhone && (
                <a
                  className="icon-button"
                  href={`tel:${o.partnerPhone}`}
                  aria-label="Call your delivery partner"
                >
                  <Phone size={18} />
                </a>
              )}
            </div>
          )}
          <p className="tiny-text">
            Updates refresh every 10 seconds. Location is supplied by your
            delivery partner.
          </p>
        </div>
      </div>
    </section>
  );
}
export function Account() {
  return (
    <RoleGate role="customer">
      <AccountDetails />
    </RoleGate>
  );
}
function AccountDetails() {
  const { session, logout, toast } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]),
    [edit, setEdit] = useState(false),
    [value, setValue] = useState<Address>(blankAddress),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      api<{ addresses: Address[] }>("/addresses")
        .then((r) => setAddresses(r.addresses))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    // Data loading updates state only after the awaited request completes.

    void load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/addresses", "POST", value);
      setEdit(false);
      setValue(blankAddress);
      await load();
      toast("Address saved. One less detail for next time.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api("/addresses/" + id, "DELETE", {});
      await load();
      toast("Address removed.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <main className="container page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">YOUR LITTLE CORNER</span>
          <h1>Hello, {session.user?.name.split(" ")[0]}.</h1>
          <p>{session.user?.email}</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => void logout().catch((e) => toast(e.message))}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
      <div className="account-links">
        <Link href="/orders">
          <Package size={26} />
          <div>
            <h2>Your orders</h2>
            <p>See what’s on the way.</p>
          </div>
          <ArrowRight size={19} />
        </Link>
        <Link href="/products">
          <ShoppingBag size={26} />
          <div>
            <h2>A little more shopping</h2>
            <p>Find your everyday favorites.</p>
          </div>
          <ArrowRight size={19} />
        </Link>
      </div>
      <div className="section-title">
        <h2>Your familiar places.</h2>
        <button className="button button-outline" onClick={() => setEdit(true)}>
          Add an address
        </button>
      </div>
      <ErrorMessage message={error} />
      <div className="address-grid">
        {addresses.map((a) => (
          <article className="address-card" key={a.id}>
            <MapPin size={22} />
            <h3>{a.label}</h3>
            <b>{a.name}</b>
            <p>
              {a.street}
              <br />
              {a.city}, {a.state} {a.zip}
              <br />
              {a.phone}
            </p>
            <button className="text-link" onClick={() => void remove(a.id!)}>
              <Trash2 size={14} /> Remove
            </button>
          </article>
        ))}
        {!addresses.length && (
          <p className="muted">
            No saved addresses yet. Add your home or workplace for a quicker
            checkout.
          </p>
        )}
      </div>
      {edit && (
        <Modal
          wide
          title="A new place for fresh deliveries."
          onClose={() => setEdit(false)}
        >
          <form onSubmit={save}>
            <AddressFields
              value={value}
              onChange={setValue}
              demo={session.user?.demo}
            />
            <ErrorMessage message={error} />
            <button className="button button-green" disabled={busy}>
              {busy ? "Saving…" : "Save address"}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
