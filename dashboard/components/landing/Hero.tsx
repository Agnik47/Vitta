"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Staggered text entrance
      gsap.from(headlineRef.current, {
        y: 80,
        opacity: 0,
        duration: 1.4,
        ease: "power3.out",
        delay: 0.2,
      });

      gsap.from(subRef.current, {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        delay: 0.6,
      });

      // Parallax on scroll
      gsap.to(headlineRef.current, {
        yPercent: -60,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(subRef.current, {
        yPercent: -40,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "80% top",
          scrub: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "#0d0d0d" }}
    >
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #00c951 0%, transparent 70%)" }} />
      </div>

      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 max-w-5xl">
        <h1
          ref={headlineRef}
          className="font-heading text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl lg:text-[6rem]"
        >
          Autonomous Purchasing.
          <br />
          <span style={{ color: "#00c951" }}>Cryptographic Trust.</span>
        </h1>
        <p
          ref={subRef}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-neutral-400 md:text-xl"
        >
          An AI agent that monitors prices, executes purchases when conditions
          match, and settles every transaction through Dodo Payments with
          unforgeable cryptographic receipts.
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-600">
          Scroll
        </span>
        <div className="h-12 w-px bg-gradient-to-b from-neutral-600 to-transparent" />
      </div>
    </section>
  );
}
