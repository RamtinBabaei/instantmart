"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Leaf, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "./ui";
import { useStore } from "./provider";
import { api } from "@/lib/client";
export function Footer() {
  const { toast } = useStore();
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false);
  async function subscribe(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/newsletter", "POST", {
        email,
      });
      toast(r.message);
      setEmail("");
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <footer>
      <div className="newsletter container">
        <div>
          <span className="eyebrow">
            <Leaf size={13} /> THE GOOD STUFF, IN YOUR INBOX
          </span>
          <h2>A fresh little update.</h2>
          <p>Join our list for seasonal finds and store updates.</p>
        </div>
        <form onSubmit={subscribe}>
          <Mail size={19} />
          <input
            type="email"
            required
            aria-label="Your email for store updates"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy} aria-label="Subscribe to store updates">
            {busy ? "…" : <ArrowRight size={21} />}
          </button>
        </form>
      </div>
      <div className="footer-main">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>
              Good food brings us together.
              <br />
              We make getting it a little easier.
            </p>
            <span className="footer-quality">
              <ShieldCheck size={16} /> Thoughtfully picked. Carefully
              delivered.
            </span>
          </div>
          <div>
            <h3>Your everyday shop</h3>
            <Link href="/products">All groceries</Link>
            <Link href="/deals">Fresh deals</Link>
            <Link href="/products?category=fruits-vegetables">
              Fruits & vegetables
            </Link>
            <Link href="/products?category=dairy-eggs">Dairy & eggs</Link>
          </div>
          <div>
            <h3>Here to help</h3>
            <Link href="/account">My account</Link>
            <Link href="/orders">Track my order</Link>
            <Link href="/help">Help & delivery</Link>
            <Link href="/about">Our story</Link>
          </div>
          <div>
            <h3>Behind the basket</h3>
            <Link href="/admin">
              Store management <ArrowRight size={12} />
            </Link>
            <Link href="/delivery">
              Delivery partners <ArrowRight size={12} />
            </Link>
            <Link
              href="https://github.com/RamtinBabaei/instantmart"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore the source <ArrowRight size={12} />
            </Link>
            <span className="made-by">Built by Ramtin Babaei.</span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} InstantMart. A portfolio grocery
            experience.
          </span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>
              Fresh is a way of life. <Leaf size={12} />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
