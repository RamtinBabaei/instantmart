"use client";
import { lazy, Suspense } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "./provider";
import { Header } from "./header";
import { Footer } from "./footer";
import { AuthModal } from "./auth";
import { Home } from "./home";
import { Catalog, ProductDetail } from "./catalog";
import { Account, Cart, Checkout, Orders } from "./customer";
import { Content } from "./content";
import { Empty, Loading } from "./ui";
import Link from "next/link";
const Admin = lazy(() => import("./admin"));
const Delivery = lazy(() => import("./delivery"));
function Surface() {
  const path = usePathname(),
    { catalogError, reload } = useStore();
  let content;
  if (path === "/")
    content = (
      <main>
        <Home />
      </main>
    );
  else if (path === "/products") content = <Catalog />;
  else if (path.startsWith("/products/"))
    content = <ProductDetail id={path.split("/")[2]} />;
  else if (path === "/deals") content = <Catalog deals />;
  else if (path === "/cart") content = <Cart />;
  else if (path === "/checkout") content = <Checkout />;
  else if (path === "/orders" || path.startsWith("/orders/"))
    content = <Orders id={path.split("/")[2]} />;
  else if (path === "/account") content = <Account />;
  else if (["/about", "/help", "/privacy", "/terms"].includes(path))
    content = <Content page={path.slice(1)} />;
  else if (
    ["/admin", "/admin/products", "/admin/orders", "/admin/partners"].includes(
      path,
    )
  )
    content = <Admin />;
  else if (path === "/delivery") content = <Delivery />;
  else
    content = (
      <main className="container">
        <Empty
          title="A little off the beaten aisle."
          description="We couldn’t find that page, but there’s plenty of goodness back at the shop."
        >
          <Link className="button button-green" href="/">
            Back home
          </Link>
        </Empty>
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      {catalogError && (
        <div role="alert" className="connection-error container">
          {catalogError}
          <button onClick={() => void reload()}>Try again</button>
        </div>
      )}
      <div id="main-content" tabIndex={-1}>
        <Suspense fallback={<Loading />}>{content}</Suspense>
      </div>
      <Footer />
      <AuthModal />
    </>
  );
}
export default function Application() {
  return <Surface />;
}
