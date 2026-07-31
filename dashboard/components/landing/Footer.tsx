"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer
      className="relative flex min-h-screen w-full flex-col items-center justify-center"
      style={{ background: "#00c951" }}
    >
      <div className="flex flex-col items-center text-center">
        <h2 className="font-heading text-6xl font-bold tracking-tighter leading-none sm:text-7xl md:text-[10vw]" style={{ color: "#050505" }}>
          Deploy Vitta.
        </h2>
        <p className="mt-6 max-w-lg text-lg font-medium md:text-2xl" style={{ color: "rgba(5,5,5,0.7)" }}>
          The future of autonomous financial operations.
        </p>

        <Link
          href="/overview"
          className="group mt-12 flex items-center gap-4 rounded-full px-8 py-5 text-lg font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ background: "#050505" }}
        >
          Enter the Engine
          <div className="flex size-8 items-center justify-center rounded-full bg-white/10 transition-transform group-hover:translate-x-1">
            <ArrowRight size={18} />
          </div>
        </Link>
      </div>

      <div className="absolute bottom-8 flex w-full justify-between px-12 text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(5,5,5,0.5)" }}>
        <span>© {new Date().getFullYear()} Vitta</span>
        <span>Powered by Dodo Payments</span>
      </div>
    </footer>
  );
}
