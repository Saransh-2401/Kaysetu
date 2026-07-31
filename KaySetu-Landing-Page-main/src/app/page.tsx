import type { Metadata } from "next";
import AnnounceBar from "@/components/AnnounceBar";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";
import Icon from "@/components/Icon";
import { HeroSection } from "@/components/blocks/hero-section-1";
import Comparison from "@/components/Comparison";
import ModuleShowcase from "@/components/ModuleShowcase";
import Walkthrough from "@/components/Walkthrough";
import { CardSwapDemo } from "@/components/CardSwapDemo";
import {
  StatBar,
  ProductReveal,
} from "@/components/Showcase";
import { Operations } from "@/components/Sections";
import { FAQ } from "@/components/Faq";

// Title/description come from the root layout defaults; the canonical has to be
// declared here rather than there, so it doesn't leak onto every other route.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <AnnounceBar />
      <Nav />
      <main>
        {/* 1 · Hero banner — Tailark Integration */}
        <HeroSection />
        {/* 4 · The 11 modules — auto-playing, explained one by one */}
        <ModuleShowcase />
        {/* 4 · Guided step-by-step walkthrough (the core) */}
        <Walkthrough />
        {/* 5 · The full-workspace reveal + numbered legend */}
        <ProductReveal />
        {/* 6 · Operations backbone (product depth) */}
        <Operations />
        {/* 3 · KaySetu vs. the alternative (differentiation payoff) */}
        <Comparison />
        {/* 7 · FAQ accordion */}
        <FAQ />
        {/* 8 · "Don't take our word for it" testimonial wall (just above footer) */}
        <CardSwapDemo />
      </main>

      {/* Floating Enquiry Button */}
      <Link 
        href="/contact" 
        className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-[#009688] text-white px-5 py-3 rounded-full shadow-lg hover:bg-[#007b6f] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 font-medium tracking-wide group"
        aria-label="Make an enquiry"
      >
        <Icon name="MessageSquare" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        <span className="hidden sm:inline">Enquiry</span>
      </Link>

      <Footer />
    </>
  );
}
