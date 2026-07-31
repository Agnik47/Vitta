"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function Preloader({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sanskritRef = useRef<HTMLDivElement>(null);
  const englishRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = "";
        onComplete();
      },
    });

    tl.set(sanskritRef.current, { opacity: 0, y: 20 })
      .set(englishRef.current, { opacity: 0, clipPath: "inset(0% 0% 0% 100%)" })
      .set(lineRef.current, { scaleX: 0 })

      // Line strikes across
      .to(lineRef.current, {
        scaleX: 1,
        duration: 0.8,
        ease: "power4.inOut",
      })

      // Sanskrit fades in
      .to(sanskritRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
      }, "-=0.2")

      // Vibrate/Glitch
      .to(sanskritRef.current, {
        x: "random(-3, 3)",
        y: "random(-3, 3)",
        duration: 0.04,
        repeat: 8,
        yoyo: true,
        ease: "none",
      })

      // Sanskrit wipes out
      .to(sanskritRef.current, {
        clipPath: "inset(0% 100% 0% 0%)",
        duration: 0.35,
        ease: "power2.inOut",
      })

      // English wipes in
      .set(englishRef.current, { opacity: 1 })
      .to(englishRef.current, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 0.35,
        ease: "power2.out",
      }, "-=0.15")

      // Hold
      .to({}, { duration: 0.4 })

      // Slide away
      .to(containerRef.current, {
        yPercent: -100,
        duration: 1,
        ease: "power4.inOut",
      });

    return () => {
      tl.kill();
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "#050505" }}
    >
      <div className="relative flex h-32 w-full items-center justify-center">
        {/* Strike line */}
        <div
          ref={lineRef}
          className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 origin-left"
          style={{ background: "rgba(0, 201, 81, 0.3)", transform: "scaleX(0)" }}
        />

        {/* Sanskrit */}
        <div
          ref={sanskritRef}
          className="absolute text-7xl font-bold tracking-widest md:text-8xl"
          style={{ color: "#00c951", opacity: 0 }}
        >
          वित्त
        </div>

        {/* English */}
        <div
          ref={englishRef}
          className="absolute text-7xl font-bold tracking-tight md:text-8xl"
          style={{ color: "#00c951", opacity: 0 }}
        >
          Vitta
        </div>
      </div>
    </div>
  );
}
