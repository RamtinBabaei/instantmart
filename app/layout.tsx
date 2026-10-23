import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/store/provider";

export const metadata: Metadata = {
  title: "InstantMart — A little fresher. A lot better.",
  description:
    "Fresh groceries and everyday favorites, delivered with care. A complete grocery commerce experience by Ramtin Babaei.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/outfit.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/serif.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
