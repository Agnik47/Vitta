import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mandate Gate — Dashboard",
  description: "Read-only view of mandate state, gate decisions, and receipts (Dodo test mode)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="bg-amber-500 text-center text-xs font-semibold text-black py-1">
          TEST MODE — no real money moves through this dashboard or the CLI it observes
        </div>
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-4xl gap-6 px-4 py-3 text-sm font-medium">
            <Link href="/">Mandate</Link>
            <Link href="/events">Events</Link>
            <Link href="/receipts">Receipts</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
