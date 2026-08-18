import type { Metadata } from "next";
import AnnounceBar from "@/components/AnnounceBar";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import EnquiryButton from "@/components/EnquiryButton";
import ClosingCta from "@/components/ClosingCta";
import { HeroSection } from "@/components/blocks/hero-section-1";
import Comparison from "@/components/Comparison";
import ModuleShowcase from "@/components/ModuleShowcase";
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
        {/* 5 · The full-workspace reveal + numbered legend */}
        <ProductReveal />
        {/* 6 · Operations backbone (product depth) */}
        <Operations />
        {/* 3 · KaySetu vs. the alternative (differentiation payoff) */}
        <Comparison />
        {/* 7 · FAQ accordion */}
        <FAQ />
        {/* 8 · Outcomes-by-role wall (just above footer) — no attributed quotes
            until we have real customers to name */}
        <CardSwapDemo />
        {/* 9 · Closing CTA band, straight into the footer */}
        <ClosingCta />
      </main>

      {/* Floating Enquiry Button — fades out once the footer is on screen */}
      <EnquiryButton />

      <Footer />
    </>
  );
}
