"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const FEATURES = [
  {
    title: "Deterministic Policy Engine",
    body: "Every agent action is evaluated against the cryptographic mandate before execution. If the rules don't match, the transaction is physically blocked — not just flagged.",
  },
  {
    title: "Dodo Payments Settlement",
    body: "Real financial infrastructure, not a mock API. Every purchase flows through Dodo Payments for settlement, creating an immutable proof chain that survives any audit.",
  },
  {
    title: "Zero-Trust Architecture",
    body: "The dashboard is a read-only view. Truth lives in the cryptographic ledger. The policy engine runs isolated from the UI — it cannot be overridden from the front-end.",
  },
];

export function StackedCards() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".stacked-card");

      cards.forEach((card, i) => {
        const isLast = i === cards.length - 1;

        ScrollTrigger.create({
          trigger: card,
          start: "top 35%",
          endTrigger: containerRef.current,
          end: "bottom bottom",
          pin: !isLast,
          pinSpacing: false,
        });

        if (!isLast) {
          gsap.to(card, {
            scale: 0.9,
            opacity: 0.3,
            ease: "none",
            scrollTrigger: {
              trigger: cards[i + 1],
              start: "top bottom",
              end: "top 35%",
              scrub: true,
            },
          });
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative w-full py-40" style={{ background: "#050505" }}>
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-32 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-600">Core Pillars</span>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-white md:text-6xl">
            Uncompromising Execution
          </h2>
        </div>

        <div className="flex flex-col gap-8">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.title}
              className="stacked-card rounded-3xl border border-neutral-800 p-10 shadow-2xl md:p-16"
              style={{
                background: "#111111",
                zIndex: i + 1,
                transformOrigin: "top center",
              }}
            >
              <span className="font-mono text-xs font-semibold tracking-widest" style={{ color: "#00c951" }}>
                0{i + 1}
              </span>
              <h3 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
                {feat.title}
              </h3>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-neutral-400 md:text-xl">
                {feat.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
