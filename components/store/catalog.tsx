"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { categories } from "@/lib/catalog";
import { money } from "@/lib/commerce";
import { useStore } from "./provider";
import { Empty, ProductCard, Quantity } from "./ui";
export function Catalog({ deals = false }: { deals?: boolean }) {
  const params = useSearchParams(),
    category = params.get("category") ?? "",
    query = params.get("q") ?? "";
  const { products } = useStore();
  const [sort, setSort] = useState("featured"),
    [organic, setOrganic] = useState(false),
    [inStock, setInStock] = useState(false);
  const list = products
    .filter(
      (p) =>
        p.active &&
        (!category || p.category === category) &&
        (!query ||
          `${p.name} ${p.description}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!deals || p.price < p.originalPrice) &&
        (!organic || p.organic) &&
        (!inStock || p.stock > 0),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.price - b.price
        : sort === "price-desc"
          ? b.price - a.price
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : 0,
    );
  const title = query
    ? `Fresh finds for “${query}”`
    : deals
      ? "A little more for a little less."
      : (categories.find((c) => c.id === category)?.name ??
        "Goodness, aisle by aisle.");
  return (
    <main className="container page-content">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>{deals ? "Fresh deals" : "Shop groceries"}</span>
      </div>
      <div className={`page-intro ${deals ? "deals-intro" : ""}`}>
        <div>
          <span className="eyebrow">
            {deals
              ? "EVERYDAY GOODNESS. EXTRA GOOD PRICES."
              : "YOUR EVERYDAY SHOP, REIMAGINED"}
          </span>
          <h1>{title}</h1>
          <p>
            {deals
              ? "Fresh favorites with a little saving on the side."
              : "Fresh staples, little treats, and everything in between."}
          </p>
        </div>
        {deals && (
          <div className="coupon-ticket">
            <span>A FRESH LITTLE TREAT</span>
            <b>10% OFF</b>
            <span>Use FRESH10 at checkout · up to $10</span>
          </div>
        )}
      </div>
      <div className="catalog-layout">
        <aside className="catalog-sidebar">
          <h2>
            <SlidersHorizontal size={17} /> Your aisles
          </h2>
          <Link
            href={deals ? "/deals" : "/products"}
            className={!category ? "selected" : ""}
          >
            All groceries <span>{products.filter((p) => p.active).length}</span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={category === c.id ? "selected" : ""}
              href={`${deals ? "/deals" : "/products"}?category=${c.id}`}
            >
              {c.name}
              <span>
                {products.filter((p) => p.active && p.category === c.id).length}
              </span>
            </Link>
          ))}
          <div className="sidebar-filter">
            <h3>A little more specific</h3>
            <label>
              <input
                type="checkbox"
                checked={organic}
                onChange={(e) => setOrganic(e.target.checked)}
              />{" "}
              Organic only <Leaf size={13} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
              />{" "}
              In stock
            </label>
          </div>
          <div className="sidebar-message">
            <Truck size={26} />
            <b>A little delivery joy.</b>
            <p>Fill your basket to $20 and delivery is on us.</p>
          </div>
        </aside>
        <section>
          <div className="catalog-toolbar">
            <p>
              <b>{list.length}</b> fresh finds{" "}
              {query && <span>for “{query}”</span>}
            </p>
            <label>
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>
          {list.length ? (
            <div className="product-grid catalog-products">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <Empty
              title="No fresh finds just yet."
              description="Try another aisle or a different search. We’re always making room for more goodness."
            >
              <Link href="/products" className="button button-green">
                Explore all groceries <ArrowRight size={17} />
              </Link>
            </Empty>
          )}
        </section>
      </div>
    </main>
  );
}
export function ProductDetail({ id }: { id: string }) {
  const { products, add, cart, quantity } = useStore();
  const p = products.find((p) => p.id === id && p.active);
  if (!p)
    return (
      <main className="container">
        <Empty
          title="This shelf is empty."
          description="That product is no longer available."
        >
          <Link href="/products" className="button button-green">
            Back to the shop
          </Link>
        </Empty>
      </main>
    );
  const count = cart.find((i) => i.product.id === id)?.quantity ?? 0;
  return (
    <main className="container page-content">
      <div className="breadcrumbs">
        <Link href="/products">
          <ArrowLeft size={13} /> All groceries
        </Link>
        <span>/</span>
        <span>{p.name}</span>
      </div>
      <div className="product-detail">
        <div className="detail-image">
          <img src={p.image} alt={p.name} width={600} height={540} />
          {p.organic && (
            <span className="organic-label">
              <Leaf size={13} /> Organically grown
            </span>
          )}
        </div>
        <div className="detail-info">
          <span className="eyebrow">
            {categories.find((c) => c.id === p.category)?.name}
          </span>
          <h1>{p.name}</h1>
          <span className="detail-unit">{p.unit} · Carefully selected</span>
          <div className="detail-price">
            <strong>{money(p.price)}</strong>
            <del>{p.originalPrice > p.price ? money(p.originalPrice) : ""}</del>
            {p.price < p.originalPrice && (
              <span className="discount-badge">
                Save {Math.round((1 - p.price / p.originalPrice) * 100)}%
              </span>
            )}
          </div>
          <p>{p.description}</p>
          <span className="stock-label">
            <Check size={15} />
            {p.stock
              ? `${p.stock} available · Ready for your basket`
              : "Currently sold out"}
          </span>
          <div className="detail-add">
            {count ? (
              <>
                <Quantity
                  id={p.name}
                  value={count}
                  onChange={(n) => quantity(p.id, n)}
                />
                <Link href="/cart" className="button button-green">
                  Go to basket <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <button
                disabled={!p.stock}
                className="button button-green"
                onClick={() => add(p)}
              >
                Add to your basket <ArrowRight size={17} />
              </button>
            )}
          </div>
          <div className="detail-perks">
            <span>
              <Truck size={20} /> Free delivery over $20
            </span>
            <span>
              <ShieldCheck size={20} /> Secure checkout
            </span>
            <span>
              <Leaf size={20} /> Selected for quality
            </span>
          </div>
          <details open>
            <summary>A little product care</summary>
            <p>
              Keep fresh produce refrigerated where appropriate. Check the
              packaging for storage instructions, ingredients, and allergen
              information before use.
            </p>
          </details>
        </div>
      </div>
      <section className="section">
        <div className="section-title">
          <h2>A little more you might love.</h2>
        </div>
        <div className="product-grid">
          {products
            .filter(
              (a) => a.active && a.category === p.category && a.id !== p.id,
            )
            .slice(0, 5)
            .map((a) => (
              <ProductCard key={a.id} product={a} />
            ))}
        </div>
      </section>
    </main>
  );
}
