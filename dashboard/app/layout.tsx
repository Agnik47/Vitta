import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppNavbar } from "@/components/layout/app-navbar";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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
  title: "Vitta — AI Spending Policy Dashboard",
  description: "Real-time view of mandate state, gate decisions, and receipts. Powered by Dodo Payments test mode.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // suppressHydrationWarning so the ThemeProvider can add .dark on the client
      // without a hydration mismatch warning from Next.js.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${figtree.variable} antialiased`}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <SidebarProvider style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
              <AppSidebar />
              <SidebarInset>
                <AppNavbar />
                <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
