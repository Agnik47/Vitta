"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 z-40 flex w-full items-center justify-between px-6 py-4 transition-all duration-300 ${
        scrolled ? "bg-[#050505]/80 backdrop-blur-md border-b border-[#2a2a2a]" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-32">
          <Image
            src="/logs/Vitta_DarkMode_Logo.png"
            alt="Vitta Logo"
            fill
            className="object-contain object-left"
            priority
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Link 
          href="/docs" 
          className="text-sm font-medium text-[#a1a1aa] transition-colors hover:text-white"
        >
          Documentation
        </Link>
        <Link 
          href="/overview" 
          className="rounded-full bg-[#00c951] px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-105"
        >
          Launch Engine
        </Link>
      </div>
    </nav>
  );
}
