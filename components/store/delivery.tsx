"use client";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { RoleGate, useOrders } from "./customer";
import { useStore } from "./provider";
import { Badge, Empty, ErrorMessage, Loading, Modal } from "./ui";
import { api } from "@/lib/client";
import { money } from "@/lib/commerce";
import type { Order, Status } from "@/lib/types";
export default function Delivery() {
  return (
    <RoleGate role="delivery">
      <DeliveryWorkspace />
    </RoleGate>
  );
}
function DeliveryWorkspace() {
  const { orders, loading, error, reload } = useOrders("/delivery/orders"),
    { session, toast } = useStore();
  const [tab, setTab] = useState("Active"),
    [busy, setBusy] = useState(false),
    [handoff, setHandoff] = useState<Order | null>(null),
    [otp, setOtp] = useState(""),
    [formError, setFormError] = useState(""),
    [sharing, setSharing] = useState<string | null>(null);
  const watch = useRef<number | null>(null),
    lastSent = useRef(0);
  useEffect(
    () => () => {
      if (watch.current != null)
        navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );
  async function update(o: Order, status: Status) {
    setBusy(true);
    setFormError("");
    try {
      await api("/delivery/orders/" + o.id, "PATCH", {
        status,
        ...(status === "Delivered" ? { otp } : {}),
      });
      if (status === "Delivered") {
        setTab("Completed");
        setHandoff(null);
        setOtp("");
        stopSharing();
      }
      if (status === "Out for Delivery") setTab("Active");
      await reload();
      toast(
        status === "Delivered"
          ? "Goodness delivered. Nicely done!"
          : "Delivery started. Safe travels!",
      );
    } catch (e) {
      setFormError((e as Error).message);
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function stopSharing() {
    if (watch.current != null) {
      navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    }
    setSharing(null);
  }
  function share(o: Order) {
    if (sharing === o.id) {
      stopSharing();
      return;
    }
    stopSharing();
    if (!navigator.geolocation) {
      toast("Geolocation is not supported in this browser.");
      return;
    }
    setSharing(o.id);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastSent.current < 10000) return;
        lastSent.current = Date.now();
        void api("/delivery/orders/" + o.id + "/location", "POST", {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        }).catch((e) => {
          toast(e.message);
          stopSharing();
        });
      },
      () => {
        stopSharing();
        toast(
          "Location permission was not granted. You can still complete deliveries.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }
  async function sendDemoPoint(o: Order) {
    try {
      await api("/delivery/orders/" + o.id + "/location", "POST", {
        lat: (o.address.lat ?? 45.5152) + 0.002,
        lng: (o.address.lng ?? -122.6784) + 0.002,
      });
      toast("Demo location sent. The customer’s map will update.");
      await reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  const available = orders.filter((o) => o.status === "Packed" && !o.partnerId),
    active = orders.filter(
      (o) =>
        o.partnerId === session.user?.id &&
        ["Packed", "Out for Delivery"].includes(o.status),
    ),
    done = orders.filter(
      (o) => o.status === "Delivered" && o.partnerId === session.user?.id,
    );
  const list =
    tab === "Available" ? available : tab === "Completed" ? done : active;
  return (
    <main className="container page-content delivery-workspace">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">A LITTLE GOODNESS, ON THE MOVE</span>
          <h1>Hello, {session.user?.name.split(" ")[0]}.</h1>
          <p>Every delivery is a chance to make someone’s day.</p>
        </div>
        <span className="partner-online">
          <span className="live-dot" /> Ready to deliver
        </span>
      </div>
      <div className="stat-grid">
        <article>
          <span>
            <Truck size={19} />
          </span>
          <small>Active deliveries</small>
          <b>{active.length}</b>
        </article>
        <article>
          <span>
            <Package size={19} />
          </span>
          <small>Available to pick up</small>
          <b>{available.length}</b>
        </article>
        <article>
          <span>
            <CheckCircle2 size={19} />
          </span>
          <small>Completed deliveries</small>
          <b>{done.length}</b>
        </article>
        <article>
          <span>
            <ShieldCheck size={19} />
          </span>
          <small>Cash collected</small>
          <b>
            {money(
              done
                .filter((o) => o.payment === "cash")
                .reduce((s, o) => s + o.total, 0),
            )}
          </b>
        </article>
      </div>
      <div className="delivery-toolbar">
        <div className="filter-tabs">
          {["Active", "Available", "Completed"].map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button className="text-link" onClick={() => void reload()}>
          Refresh deliveries
        </button>
      </div>
      <ErrorMessage message={error} />
      {loading ? (
        <Loading />
      ) : list.length ? (
        <div className="delivery-order-grid">
          {list.map((o) => (
            <article className="delivery-order" key={o.id}>
              <header>
                <div>
                  <span className="eyebrow">
                    ORDER #{o.id.slice(-8).toUpperCase()}
                  </span>
                  <h2>{o.customerName}</h2>
                </div>
                <Badge status={o.status} />
              </header>
              <div className="delivery-address">
                <MapPin size={23} />
                <div>
                  <b>
                    {o.address.label} · {o.address.name}
                  </b>
                  <p>
                    {o.address.street}
                    <br />
                    {o.address.city}, {o.address.state} {o.address.zip}
                  </p>
                  <a className="text-link" href={`tel:${o.address.phone}`}>
                    <Phone size={13} />
                    {o.address.phone}
                  </a>
                </div>
              </div>
              <div className="delivery-contents">
                {o.items.map((i) => (
                  <span key={i.productId}>
                    {i.quantity}× {i.name}
                  </span>
                ))}
              </div>
              <div className="delivery-payment">
                <span>
                  {o.payment === "cash"
                    ? "Collect on delivery"
                    : "Card payment"}
                </span>
                <b>{money(o.total)}</b>
              </div>
              {o.status === "Packed" && (
                <button
                  disabled={busy}
                  className="button button-green w-full"
                  onClick={() => void update(o, "Out for Delivery")}
                >
                  <Navigation size={16} /> Accept & start delivery
                </button>
              )}
              {o.status === "Out for Delivery" && (
                <>
                  <button
                    className="button button-outline w-full"
                    onClick={() => share(o)}
                  >
                    <LocateFixed size={16} />
                    {sharing === o.id
                      ? "Stop sharing location"
                      : "Share my live location"}
                  </button>
                  {session.user?.demo && (
                    <button
                      className="text-link demo-point"
                      onClick={() => void sendDemoPoint(o)}
                    >
                      Send a fictional demo location
                    </button>
                  )}
                  <button
                    className="button button-green w-full"
                    onClick={() => {
                      setHandoff(o);
                      setOtp("");
                      setFormError("");
                    }}
                  >
                    <CheckCircle2 size={16} /> Complete delivery
                  </button>
                </>
              )}
              {o.status === "Delivered" && (
                <p className="success-message">
                  <CheckCircle2 size={17} /> Delivered with care.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            tab === "Completed"
              ? "Your first delivery is ahead."
              : tab === "Available"
                ? "No baskets waiting right now."
                : "A little breathing room."
          }
          description={
            tab === "Available"
              ? "Orders appear here when the store marks them as packed."
              : "Pick up an available order to get the goodness moving."
          }
        >
          {tab !== "Available" && (
            <button
              className="button button-green"
              onClick={() => setTab("Available")}
            >
              See available deliveries
            </button>
          )}
        </Empty>
      )}
      {handoff && (
        <Modal title="One last little check." onClose={() => setHandoff(null)}>
          <div className="handoff-modal">
            <ShieldCheck size={34} />
            <h3>Groceries at the door?</h3>
            <p>
              Ask {handoff.customerName} for the six-digit code shown in their
              order tracking page.
            </p>
            {handoff.payment === "cash" && (
              <p className="cash-reminder">
                Collect <b>{money(handoff.total)}</b> before completing
                delivery.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void update(handoff, "Delivered");
              }}
            >
              <label>
                Customer’s delivery code
                <input
                  className="otp-input"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                />
              </label>
              <ErrorMessage message={formError} />
              <button disabled={busy} className="button button-green w-full">
                {busy ? "Checking…" : "Confirm delivery"}
                <CheckCircle2 size={17} />
              </button>
            </form>
          </div>
        </Modal>
      )}
    </main>
  );
}
