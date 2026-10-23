"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Leaf, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "./provider";
import { ErrorMessage, Modal } from "./ui";
import type { Role } from "@/lib/types";
export function AuthForm({ role = "customer" }: { role?: Role }) {
  const { authenticate, demo, session } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const redirect = (r: Role) =>
    router.push(
      r === "admin" ? "/admin" : r === "delivery" ? "/delivery" : "/",
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      const u = await authenticate(mode, values);
      redirect(u.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function startDemo() {
    setBusy(true);
    setError("");
    try {
      const u = await demo(role);
      redirect(u.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-form">
      <div className="auth-symbol">
        <Leaf size={26} />
      </div>
      <h3>
        {role === "admin"
          ? "Your store, at a glance."
          : role === "delivery"
            ? "Good things, on the way."
            : mode === "register"
              ? "A fresher start."
              : "Welcome back."}
      </h3>
      <p>
        {role === "customer"
          ? "Sign in for a little more everyday goodness."
          : `Sign in with your ${role === "admin" ? "store manager" : "delivery partner"} account.`}
      </p>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && (
          <label>
            Full name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            placeholder="At least 10 characters"
          />
        </label>
        <ErrorMessage message={error} />
        <button disabled={busy} className="button button-green">
          {busy
            ? "Please wait…"
            : mode === "register"
              ? "Create account"
              : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      {role === "customer" && (
        <p className="auth-switch">
          {mode === "login"
            ? "New to InstantMart?"
            : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      )}
      {session.demoEnabled && (
        <>
          <div className="or-divider">
            <span>or take a look around</span>
          </div>
          <button
            className="button button-outline w-full"
            disabled={busy}
            onClick={startDemo}
          >
            Explore{" "}
            {role === "customer"
              ? "customer"
              : role === "admin"
                ? "admin"
                : "delivery"}{" "}
            demo
            <ArrowRight size={16} />
          </button>
          <p className="tiny-text">
            <LockKeyhole size={12} /> Your demo workspace is private to this
            browser.
          </p>
        </>
      )}
    </div>
  );
}
export function AuthModal() {
  const { authOpen, setAuthOpen } = useStore();
  return authOpen ? (
    <Modal title="Your InstantMart account" onClose={() => setAuthOpen(false)}>
      <AuthForm />
    </Modal>
  ) : null;
}
