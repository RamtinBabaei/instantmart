"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Leaf,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { categories } from "@/lib/catalog";
import { useStore } from "./provider";
import { ProductCard, SectionTitle } from "./ui";
export function Home() {
  const { products } = useStore();
  return (
    <>
      <section className="container hero">
        <picture>
          <source
            media="(max-width: 700px)"
            srcSet="/images/hero-mobile.webp"
          />
          <img
            className="hero-photo"
            src="/images/hero.webp"
            alt="Freshly harvested tomatoes, peppers, asparagus and leafy greens"
            width={1400}
            height={930}
            fetchPriority="high"
          />
        </picture>
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-eyebrow">
            <span /> FRESH FINDS. EVERY DAY.
          </span>
          <h1>
            A little fresher.
            <br />A lot <em>better.</em>
          </h1>
          <p>
            From the farm to your family. Discover fresh groceries and everyday
            favorites, delivered with care.
          </p>
          <Link className="button button-orange" href="/products">
            Fill your basket <ArrowRight size={18} />
          </Link>
          <span className="hero-footnote">
            <Truck size={16} /> Free delivery on orders over $20
          </span>
        </div>
        <div className="hero-stamp">
          <Leaf size={23} />
          <span>
            Goodness
            <br />
            <b>in every bag.</b>
          </span>
        </div>
        <div className="hero-index">
          <b>01</b>
          <span /> Fresh starts here
        </div>
      </section>
      <div className="container benefits">
        {[
          [Truck, "Fresh to your door", "Free delivery over $20"],
          [Leaf, "Naturally good", "Organic options you’ll love"],
          [Clock3, "Made for your day", "Convenient local delivery"],
          [ShieldCheck, "Shop with confidence", "Secure, simple checkout"],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof Truck;
          return (
            <div key={title as string}>
              <span>
                <I size={23} strokeWidth={1.6} />
              </span>
              <div>
                <h3>{title as string}</h3>
                <p>{desc as string}</p>
              </div>
            </div>
          );
        })}
      </div>
      <section className="container section categories-section">
        <SectionTitle
          eyebrow="A BASKET FULL OF POSSIBILITIES"
          title="What’s on your list?"
          href="/products"
          label="Explore the aisles"
        />
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link
              href={`/products?category=${c.id}`}
              className={`category-tile category-color-${i % 5}`}
              key={c.id}
            >
              <span className="category-image">
                <img
                  src={c.image}
                  alt=""
                  width={160}
                  height={140}
                  loading="lazy"
                />
              </span>
              <h3>{c.name}</h3>
              <span className="category-arrow">
                <ArrowUpRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="PICKED WITH CARE, LOVED EVERY DAY"
          title="Fresh picks for your everyday."
          href="/products"
        />
        <div className="product-grid">
          {products
            .filter((p) => p.active)
            .slice(0, 5)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="container collection-grid">
        <Link
          href="/products?category=fruits-vegetables"
          className="collection collection-green"
        >
          <div>
            <span className="eyebrow">STRAIGHT FROM NATURE</span>
            <h2>
              Freshness you
              <br />
              can feel good about.
            </h2>
            <span className="text-link">
              Shop the harvest <ArrowRight size={17} />
            </span>
          </div>
          <img
            src="/images/fruits_vegetables.webp"
            alt="A harvest of fresh vegetables"
            width={400}
            height={360}
            loading="lazy"
          />
        </Link>
        <Link
          href="/products?category=dairy-eggs"
          className="collection collection-cream"
        >
          <div>
            <span className="eyebrow">THE MORNING ESSENTIALS</span>
            <h2>
              Make room for
              <br />a better breakfast.
            </h2>
            <span className="text-link">
              Rise & shine <ArrowRight size={17} />
            </span>
          </div>
          <img
            src="/images/dairy_eggs.webp"
            alt="Milk and breakfast essentials"
            width={400}
            height={360}
            loading="lazy"
          />
        </Link>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="SMALL PRICES. BIG SMILES."
          title="Good food. Even better deals."
          href="/deals"
          label="Shop all deals"
        />
        <div className="product-grid">
          {[...products]
            .filter((p) => p.active && p.originalPrice > p.price)
            .sort(
              (a, b) =>
                1 - b.price / b.originalPrice - (1 - a.price / a.originalPrice),
            )
            .slice(0, 5)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="container first-order">
        <div className="first-order-icon">
          <ShoppingBagIllustration />
        </div>
        <div>
          <span className="eyebrow">YOUR BASKET DESERVES A LITTLE EXTRA</span>
          <h2>Hello, fresh beginnings.</h2>
          <p>
            Take 10% off with <b>FRESH10</b>. A little welcome, from us to you.
          </p>
        </div>
        <Link className="button button-green" href="/products">
          Let’s get shopping <ArrowRight size={17} />
        </Link>
        <span className="first-order-note">
          Up to $10 off · Applies at checkout
        </span>
      </section>
      <section className="container story-strip">
        <span className="story-leaf">
          <Leaf size={36} strokeWidth={1} />
        </span>
        <p>
          Better food. Happier homes.
          <br />
          <em>A little more goodness in every day.</em>
        </p>
        <Link href="/about" className="text-link">
          The InstantMart story <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
function ShoppingBagIllustration() {
  return (
    <svg
      width="85"
      height="100"
      viewBox="0 0 85 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 35H68L75 89H13L20 35Z"
        fill="#f9f2e1"
        stroke="#1b3022"
        strokeWidth="2"
      />
      <path d="M30 38V25C30 8 57 8 57 25V38" stroke="#1b3022" strokeWidth="2" />
      <path d="M43 69C24 69 24 48 43 51C43 51 62 51 43 76Z" fill="#6b8459" />
      <path d="M42 76L45 54" stroke="#1b3022" strokeWidth="1.5" />
    </svg>
  );
}
