import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "@/app/globals.css"; // Reuse global CSS tokens, but we will force the .dark class

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vitta | Autonomous Financial Engine",
  description: "Cryptographically secure autonomous purchasing.",
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${figtree.variable} antialiased`}
    >
      {/* We strictly enforce dark mode bg and text to prevent flashes */}
      <body className="bg-[#0d0d0d] text-[#f0f0f0] selection:bg-[#00c951] selection:text-black">
        {children}
      </body>
    </html>
  );
}
