"use client";
import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Truck } from "lucide-react";
export function Content({ page }: { page: string }) {
  if (page === "about")
    return (
      <main className="container page-content">
        <section className="about-hero">
          <span className="eyebrow">GOOD FOOD. GOOD COMPANY.</span>
          <h1>
            A little more
            <br />
            <em>goodness.</em> Every day.
          </h1>
          <p>
            We believe the best part of your day can start with something as
            simple as a fresh apple, a warm breakfast, or a thoughtfully filled
            basket.
          </p>
          <Link href="/products" className="button button-green">
            Discover your everyday favorites <ArrowRight size={17} />
          </Link>
          <img
            src="/images/hero.webp"
            alt="An abundant selection of colorful, fresh vegetables"
            width={1400}
            height={600}
          />
        </section>
        <div className="about-values">
          {[
            [
              Leaf,
              "Thoughtfully picked.",
              "Fresh produce, organic options, and pantry staples, all in one place.",
            ],
            [
              Truck,
              "Carefully delivered.",
              "Follow your basket from the store to the doorstep, with updates along the way.",
            ],
            [
              ShieldCheck,
              "A little peace of mind.",
              "Transparent prices, secure accounts, and a delivery code for the final handoff.",
            ],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Leaf;
            return (
              <article key={title as string}>
                <I size={30} strokeWidth={1.3} />
                <h2>{title as string}</h2>
                <p>{text as string}</p>
              </article>
            );
          })}
        </div>
        <section className="about-project">
          <span className="eyebrow">BEHIND THIS LITTLE STORE</span>
          <h2>Built with a lot of care.</h2>
          <p>
            InstantMart is a working portfolio project by Ramtin Babaei. Explore
            the full customer, store management, and delivery experience in an
            isolated demo workspace. Orders in the demo are for exploration: no
            groceries are dispatched and no money is collected.
          </p>
          <a
            className="text-link"
            href="https://github.com/RamtinBabaei/instantmart"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore the project on GitHub <ArrowRight size={17} />
          </a>
        </section>
      </main>
    );
  const isHelp = page === "help",
    isPrivacy = page === "privacy";
  return (
    <main className="container page-content prose-page">
      <span className="eyebrow">
        {isHelp ? "A LITTLE HELP GOES A LONG WAY" : "THE DETAILS, CLEARLY"}
      </span>
      <h1>
        {isHelp
          ? "Good questions. Simple answers."
          : isPrivacy
            ? "Your privacy, thoughtfully handled."
            : "A few clear terms."}
      </h1>
      {isHelp ? (
        <>
          <p>
            Everything you need to know about your basket and this portfolio
            experience.
          </p>
          {[
            [
              "How do I try the complete demo?",
              "Choose “Explore customer demo” when signing in. Place a cash-on-delivery order using a fictional address. Open Store management in the footer and choose the admin demo to confirm and pack the order. Open Delivery partners, choose the delivery demo, and accept the order. Return to the customer demo to see live status updates and the delivery code. The same browser keeps your isolated workspace across role changes.",
            ],
            [
              "How much is delivery?",
              "Delivery is free when the basket subtotal is $20 or more. Smaller baskets have a $2.99 delivery fee. A 5% demonstration tax is shown separately at checkout. Actual tax rules must be configured for a real store before trading.",
            ],
            [
              "Can I pay by card?",
              "The public portfolio demo uses cash on delivery without collecting money. Production card checkout is implemented using Stripe-hosted Checkout and signed webhooks. It becomes available only after the store owner configures both Stripe secrets.",
            ],
            [
              "How does FRESH10 work?",
              "FRESH10 takes 10% off the basket subtotal, up to $10 per order. Enter it during checkout. The server checks the code and calculates the final total. The demo permits this code on every order.",
            ],
            [
              "How do I track my delivery?",
              "Open Your orders, then View order. The status refreshes every 10 seconds. When a delivery partner explicitly shares a location, the map shows the latest received coordinates. Location sharing requires browser permission and a secure connection. No movement or arrival times are fabricated.",
            ],
            [
              "What is my delivery code?",
              "Your six-digit code appears on your order tracking page. Share it with your partner only after receiving the order. The partner must enter the correct code before marking the delivery complete.",
            ],
            [
              "Can I cancel an order?",
              "Unpaid cash orders can be cancelled before they are out for delivery. An unfinished card checkout expires after 30 minutes. Cancelling returns reserved inventory to the store. Paid orders require a store-assisted refund; no automatic refund is claimed.",
            ],
            [
              "How do I report a problem?",
              "Open a GitHub issue using the project link below. Include the page and steps that caused the issue. Never include passwords, payment details, your delivery code, or private addresses in a public issue.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <Link
            href="https://github.com/RamtinBabaei/instantmart/issues"
            className="button button-green"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report an issue <ArrowRight size={16} />
          </Link>
        </>
      ) : isPrivacy ? (
        <>
          <p>
            Last updated October 23, 2026. This is a portfolio application.
            Please use fictional details when exploring the demo.
          </p>
          <h2>Information stored</h2>
          <p>
            The application stores account names, email addresses, salted
            password hashes, saved delivery addresses, orders, inventory, and
            delivery status records. Optional delivery coordinates are stored
            only after explicit location sharing. Newsletter signup stores your
            email address; it does not automatically send email.
          </p>
          <h2>Cookies and local storage</h2>
          <p>
            An HTTP-only cookie maintains your signed-in session for up to seven
            days. A separate HTTP-only cookie keeps your isolated demo
            workspace. Your basket is saved in your browser’s local storage. No
            advertising trackers are included.
          </p>
          <h2>Who can see order details?</h2>
          <p>
            Customers can access their own orders. Store managers can access
            orders in their store. Delivery partners can access assigned
            deliveries and packed orders available for pickup in that store.
            Demo workspaces are separated from one another. Uploaded product
            images are public storefront assets.
          </p>
          <h2>Third-party services</h2>
          <p>
            Cloudflare hosts the application, SQL records, and uploaded product
            images. OpenStreetMap receives the coordinates needed to display an
            embedded map. Stripe hosts card checkout when configured; the
            application never receives card numbers. Maps load only when
            coordinates are available.
          </p>
          <h2>Retention and control</h2>
          <p>
            You can remove saved addresses in My account, sign out to invalidate
            your current session, and clear your browser basket. Store owners
            must implement a retention and data-request process before a
            commercial launch. Demo records remain in the database until the
            operator removes them.
          </p>
        </>
      ) : (
        <>
          <p>
            Last updated October 23, 2026. InstantMart is a software portfolio
            experience, not a live grocery retailer.
          </p>
          <h2>Demo orders</h2>
          <p>
            Demo checkouts create persistent software records to explore order
            management and delivery. They do not purchase goods, schedule a
            delivery, collect cash, or create a contract for groceries. Use
            fictional names, phone numbers, and delivery addresses.
          </p>
          <h2>Pricing and payments</h2>
          <p>
            Prices are shown in US dollars. Delivery is free on basket subtotals
            of at least $20 and $2.99 otherwise. The example tax rate is 5%.
            FRESH10 reduces the subtotal by 10%, up to $10. The server
            calculates every order total. Card checkout is unavailable without
            configured Stripe credentials.
          </p>
          <h2>Accounts and use</h2>
          <p>
            Keep credentials and delivery codes private. Do not upload personal,
            illegal, or infringing content. Product images are publicly
            accessible. Do not submit real payment information into any field in
            this application.
          </p>
          <h2>Before commercial operation</h2>
          <p>
            The operator must configure regional taxes, payment processing,
            refunds, account recovery, data retention, service areas, delivery
            operations, and customer support. See the repository’s testing and
            deployment documentation for the verification scope.
          </p>
        </>
      )}
    </main>
  );
}
