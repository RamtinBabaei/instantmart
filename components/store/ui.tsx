"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Leaf,
  Minus,
  Plus,
  ShoppingBasket,
  X,
} from "lucide-react";
import { useStore } from "./provider";
import type { Product } from "@/lib/types";
import { money } from "@/lib/commerce";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="InstantMart home">
      <span className="logo-icon">
        <ShoppingBasket size={24} />
        <Leaf size={12} />
      </span>
      <span>
        instant<span>mart</span>
        <b aria-hidden="true">✦</b>
      </span>
    </Link>
  );
}
export function Quantity({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="quantity">
      <button
        type="button"
        aria-label={`Remove one ${id}`}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <span aria-label="Quantity">{value}</span>
      <button
        type="button"
        aria-label={`Add one ${id}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function ProductCard({ product: p }: { product: Product }) {
  const { add, cart, quantity } = useStore();
  const count = cart.find((i) => i.product.id === p.id)?.quantity ?? 0;
  const discount = Math.round((1 - p.price / p.originalPrice) * 100);
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {discount > 0 && (
          <span className="discount-badge">{discount}% OFF</span>
        )}
        <Link href={`/products/${p.id}`} aria-label={`View ${p.name}`}>
          <img
            src={p.image}
            alt={p.name}
            width={300}
            height={260}
            loading="lazy"
            decoding="async"
          />
        </Link>
        {p.organic && (
          <span className="organic-label">
            <Leaf size={10} /> Organic
          </span>
        )}
      </div>
      <div className="product-card-body">
        <span className="product-unit">{p.unit}</span>
        <Link href={`/products/${p.id}`}>
          <h3>{p.name}</h3>
        </Link>
        <div className="product-card-bottom">
          <div>
            <strong>{money(p.price)}</strong>
            {p.originalPrice > p.price && <del>{money(p.originalPrice)}</del>}
          </div>
          {count ? (
            <Quantity
              id={p.name}
              value={count}
              onChange={(n) => quantity(p.id, n)}
            />
          ) : (
            <button
              disabled={!p.stock}
              onClick={() => add(p)}
              className="add-button"
              aria-label={`Add ${p.name} to cart`}
            >
              {p.stock ? (
                <>
                  <Plus size={14} /> Add
                </>
              ) : (
                "Sold out"
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  href,
  label = "View all products",
}: {
  eyebrow: string;
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-link">
          {label}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ShoppingBasket size={30} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error-message" role="alert">
      {message}
    </p>
  ) : null;
}
export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p className="success-message" role="status">
      <Check size={17} />
      {children}
    </p>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      Loading your fresh finds…
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      {status}
    </span>
  );
}
