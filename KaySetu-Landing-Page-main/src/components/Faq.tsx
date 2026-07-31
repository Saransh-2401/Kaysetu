"use client";

import { useState } from "react";
import { ArrowRight, Plus, HeadphonesIcon } from "lucide-react";
import { Reveal } from "@/components/Motion";
import { faqs } from "@/lib/content";

/* ============================================================
   12 · FAQ — dock.cool-style: sticky heading on the left, a
   card-based accordion on the right that reveals smoothly and
   keeps a single answer open at a time.
   ============================================================ */

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-[#f2f6f9] py-20 md:py-28">
      <div className="w-full px-8 md:px-16 lg:px-24 xl:px-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Left — sticky header + support prompt */}
          <div className="lg:sticky lg:top-32 lg:self-start max-w-md">
            <h2 className="font-display text-[2.2rem] font-extrabold leading-[1.1] text-[#0f172a] tracking-tight balance md:text-[2.8rem]">
              Questions,
              <br /> answered.
            </h2>
            <p className="mt-5 max-w-sm text-[1rem] leading-relaxed text-[#475569]">
              Everything you need to know about running your business on KaySetu.
              Can&apos;t find what you&apos;re after?
            </p>

            {/* Talk to us CTA */}
            <div className="mt-8 relative overflow-hidden rounded-2xl bg-[#0b111a] p-6 flex flex-col gap-5 border border-[#1e2a3a] shadow-xl">
              <div
                className="absolute left-0 top-0 w-full h-full opacity-[0.12] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '14px 14px' }}
              />
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18202b] border border-[#232d3b]">
                  <HeadphonesIcon className="h-5 w-5 text-[#3b82f6]" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-[1.05rem] font-bold text-white tracking-tight">Still have questions?</h3>
                  <p className="mt-1 text-[0.85rem] leading-relaxed text-[#8e9bae]">
                    Our support team is ready to help you.
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@kayease.com"
                className="relative z-10 group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#232d3b] bg-[#141b26] px-4 py-2.5 text-[0.9rem] font-semibold text-[#3b82f6] transition hover:bg-[#1a2230]"
              >
                Talk to us
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* Right — accordion */}
          <div className="flex flex-col gap-3">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={f.q} delay={i * 50}>
                  <div
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-300 hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="font-medium text-[0.95rem] leading-snug text-[#1e293b]">{f.q}</span>
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-accent transition-transform duration-300"
                        style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </span>
                    </button>

                    {/* Smooth reveal via grid-rows 0fr → 1fr */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 pb-5 pr-12 text-[0.95rem] leading-relaxed text-[#475569]">
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
