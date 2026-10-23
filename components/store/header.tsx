"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "./ui";
import { useStore } from "./provider";
import { money } from "@/lib/commerce";
export function Header() {
  const { cart, session, setAuthOpen, logout, toast, demo } = useStore(),
    router = useRouter(),
    path = usePathname();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const count = cart.reduce((s, i) => s + i.quantity, 0),
    subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  function search(e: FormEvent) {
    e.preventDefault();
    router.push("/products?q=" + encodeURIComponent(query.trim()));
  }
  return (
    <>
      <div className="announcement">
        <span>Good food. Great days.</span>
        <p>
          Free delivery on your first order over $20 <span>✦</span> Freshness,
          delivered.
        </p>
        <Link href="/deals">
          Shop today’s deals <ArrowUpRight size={13} />
        </Link>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <Logo />
          <Link href="/account" className="delivery-location">
            <MapPin size={19} />
            <span>
              <small>Delivering fresh to</small>
              <strong>
                Your neighborhood <ChevronDown size={12} />
              </strong>
            </span>
          </Link>
          <form className="search-box" onSubmit={search} role="search">
            <Search size={18} />
            <input
              aria-label="Search groceries"
              placeholder="Search for a little everyday goodness…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <button
            className="account-button"
            onClick={() =>
              session.user ? router.push("/account") : setAuthOpen(true)
            }
          >
            <UserRound size={21} />
            <span>
              {session.user ? session.user.name.split(" ")[0] : "Sign in"}
            </span>
          </button>
          <Link
            href="/cart"
            className="cart-button"
            aria-label={`Your cart, ${count} ${count === 1 ? "item" : "items"}`}
          >
            <ShoppingBag size={18} />
            <span>
              My basket{" "}
              <small>{count ? money(subtotal) : "Let’s fill it"}</small>
            </span>
            <b>{count}</b>
          </Link>
          <button
            className="mobile-menu icon-button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        <nav
          className={`container nav-row ${open ? "nav-open" : ""}`}
          aria-label="Main navigation"
        >
          <div>
            {[
              ["/", "Home"],
              ["/products", "Shop all"],
              ["/deals", "Fresh deals"],
              ["/about", "Our story"],
              ["/orders", "Track your order"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={path === href ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                {label}
                {href === "/deals" && <span className="nav-dot" />}
              </Link>
            ))}
          </div>
          <Link href="/help" className="nav-note">
            <span className="live-dot" /> A little help? We’re here for you{" "}
            <ArrowUpRight size={13} />
          </Link>
        </nav>
      </header>
      {session.user?.demo && (
        <div className="demo-banner">
          <div className="container">
            <span>
              <b>Demo workspace</b> ·{" "}
              {session.user.role === "customer"
                ? "Customer"
                : session.user.role === "admin"
                  ? "Store manager"
                  : "Delivery partner"}
            </span>
            <div>
              <button
                onClick={() =>
                  void demo("customer")
                    .then(() => router.push("/"))
                    .catch((e) => toast(e.message))
                }
              >
                Shop
              </button>
              <button
                onClick={() =>
                  void demo("admin")
                    .then(() => router.push("/admin"))
                    .catch((e) => toast(e.message))
                }
              >
                Admin
              </button>
              <button
                onClick={() =>
                  void demo("delivery")
                    .then(() => router.push("/delivery"))
                    .catch((e) => toast(e.message))
                }
              >
                Delivery
              </button>
              <button
                onClick={() => void logout().catch((e) => toast(e.message))}
              >
                Exit demo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
