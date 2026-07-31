"use client";

import { useState } from "react";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Preloader } from "@/components/landing/Preloader";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { Workflow } from "@/components/landing/Workflow";
import { StackedCards } from "@/components/landing/StackedCards";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SmoothScroll>
      {isLoading && <Preloader onComplete={() => setIsLoading(false)} />}
      
      <main className="relative w-full bg-black">
        <LandingNavbar />
        
        {/* Main Content - Needs a z-index higher than the fixed footer and a bottom margin equal to footer height */}
        <div className="relative z-10 mb-[100vh] bg-[#0d0d0d]">
          <Hero />
          <Workflow />
          <StackedCards />
        </div>
        
        {/* Footer Reveal (Curtain Effect) - Fixed at the bottom behind the content */}
        <div className="fixed bottom-0 left-0 z-0 w-full">
          <Footer />
        </div>
      </main>
    </SmoothScroll>
  );
}
