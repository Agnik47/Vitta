"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STEPS = [
  {
    num: "01",
    title: "Set the Mandate",
    body: "Define spending caps, approved merchants, per-transaction limits, and an expiry window. The mandate is cryptographically signed — no one can tamper with it.",
  },
  {
    num: "02",
    title: "Agent Monitors & Strikes",
    body: "The Price Sniper watches target products across marketplaces. When the price drops below your threshold, it wakes up, navigates the store, and adds items to cart — all autonomously.",
  },
  {
    num: "03",
    title: "Settle & Prove",
    body: "Dodo Payments processes the transaction. An unforgeable cryptographic receipt is written to the ledger. You get a signed proof chain viewable on the dashboard.",
  },
];

export function Workflow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const track = trackRef.current;
      if (!track) return;

      const totalScroll = track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: -totalScroll,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${totalScroll}`,
          invalidateOnRefresh: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative h-screen w-full overflow-hidden" style={{ background: "#080808" }}>
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      {/* Section Label */}
      <div className="absolute left-8 top-8 z-10">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-600">How it works</span>
      </div>

      <div ref={trackRef} className="flex h-full items-center">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="flex h-full w-screen shrink-0 items-center justify-center px-8 md:px-20"
          >
            <div className="flex max-w-3xl flex-col gap-6">
              <span className="font-mono text-sm font-semibold tracking-widest" style={{ color: "#00c951" }}>
                {step.num}
              </span>
              <h2 className="font-heading text-4xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
                {step.title}
              </h2>
              <p className="max-w-lg text-lg leading-relaxed text-neutral-400 md:text-xl">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
