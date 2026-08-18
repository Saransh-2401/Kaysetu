import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import { Reveal } from "@/components/Motion";
import { industryPages, industryIndex, flow } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: industryIndex.seo.title },
  description: industryIndex.seo.description,
  keywords: industryIndex.seo.keywords,
  alternates: { canonical: "/industries" },
  openGraph: {
    title: industryIndex.seo.title,
    description: industryIndex.seo.description,
    type: "website",
    images: ["/opengraph-image"],
    url: "/industries",
    siteName: "KaySetu",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: industryIndex.seo.title,
    description: industryIndex.seo.description,
  },
};

export default function IndustriesPage() {
  return (
    <PageShell>
      {/* ── Editorial hero ───────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-line">
        {/* Custom Industries Page Hero Background Artwork */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/industries-hero-bg.png"
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-paper/40" />
        </div>

        <div className="relative mx-auto grid max-w-[1600px] gap-12 px-5 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <div>
            <h1 className="font-display text-[2.4rem] font-bold leading-[1.02] tracking-tight balance md:text-[3.6rem]">
              Built for how your industry{" "}
              <span className="text-accent">actually sells.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.12rem] leading-relaxed text-muted">
              {industryIndex.lead}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="btn-primary group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[0.98rem] font-semibold"
              >
                Book a Free Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/packages"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-paper"
              >
                Explore the packages
              </Link>
            </div>
          </div>

          {/* Signature "directory" panel — a magazine table-of-contents
              that doubles as navigation into each vertical. */}
          <Reveal className="relative" delay={120}>
            <div className="absolute -inset-5 -z-10 rounded-[32px] bg-[radial-gradient(65%_60%_at_75%_15%,rgba(0,150,136,0.16),transparent_72%)]" />
            <div className="shadow-float overflow-hidden rounded-[22px] border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-faint">
                  Industry directory
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />
                  One platform
                </span>
              </div>
              <ul className="divide-y divide-line-2">
                {industryPages.map((ind, i) => (
                  <li key={ind.slug}>
                    <Link
                      href={`/industries/${ind.slug}`}
                      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/70"
                    >
                      <span className="font-mono text-[0.7rem] font-semibold text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                        <Icon name={ind.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[0.9rem] font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
                        {ind.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </header>

      {/* ── Vertical cards — rich, interactive, workflow-previewed ── */}
      <section className="mx-auto max-w-[1600px] px-5 py-16 md:py-24">
        <div className="mb-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-[1.7rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.2rem]">
              Nine verticals, one unified ERP + CRM.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {industryPages.map((ind, i) => (
            <Reveal
              key={ind.slug}
              delay={(i % 4) * 70}
              className="h-full min-w-0"
            >
              <Link
                href={`/industries/${ind.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[#009688]/40 hover:shadow-xl sm:rounded-3xl sm:p-6"
              >
                {/* Active top gradient accent line */}
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-[#009688] via-[#26a69a] to-[#00796b] transition-transform duration-300 group-hover:scale-x-100" />
                
                {/* Background radial glow on hover */}
                <div aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 bg-[radial-gradient(80%_80%_at_50%_0%,rgba(0,150,136,0.06),transparent)] transition-opacity duration-500 group-hover:opacity-100" />

                {/* Oversized ghost icon watermark */}
                <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-3 hidden text-slate-900/[0.03] transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:text-[#009688]/[0.08] sm:block">
                  <Icon name={ind.icon} className="h-28 w-28" strokeWidth={1.2} />
                </span>

                {/* Top Row: Dual-Tone Icon Badge + Number Pill */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#009688]/20 bg-[#009688]/10 text-[#009688] shadow-xs transition-all duration-300 group-hover:border-[#009688] group-hover:bg-[#009688] group-hover:text-white group-hover:shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Icon name={ind.icon} className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 font-mono text-[0.62rem] font-bold text-slate-400 transition-colors group-hover:border-[#009688]/20 group-hover:bg-[#009688]/10 group-hover:text-[#009688] sm:px-3 sm:py-1 sm:text-[0.7rem]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Title & Tagline */}
                <h3 className="relative z-10 mt-3 font-display text-[0.85rem] font-bold leading-snug tracking-tight text-[#10234b] transition-colors duration-300 group-hover:text-[#009688] sm:mt-5 sm:text-xl">
                  <Amp text={ind.name} />
                </h3>
                <div className="relative z-10 flex-1">
                  <p className="mt-1.5 text-[0.68rem] leading-relaxed text-slate-600 line-clamp-3 sm:mt-2 sm:text-[0.88rem] sm:line-clamp-none">
                    {ind.tagline}
                  </p>
                </div>

                {/* Connected Module Workflow Chain */}
                <div className="relative z-10 mt-6 hidden rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 transition-colors duration-300 group-hover:border-[#009688]/20 group-hover:bg-[#009688]/5 sm:block">
                  <div className="flex items-center justify-between">
                    {ind.workflow.steps.slice(0, 4).map((step, s) => (
                      <span key={step.label} className="flex items-center gap-1">
                        <span
                          title={step.label}
                          className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-[#009688] shadow-2xs transition-all group-hover:border-[#009688]/30 group-hover:shadow-xs"
                        >
                          <Icon name={step.icon} className="h-3.5 w-3.5" />
                        </span>
                        {s < 3 && <span className="h-0.5 w-2 rounded-full bg-slate-200 group-hover:bg-[#009688]/30 transition-colors" />}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action CTA Footer */}
                <div className="relative z-10 mt-4 flex items-center justify-between border-t border-slate-100 pt-3 sm:mt-5 sm:pt-4">
                  <span className="text-[0.68rem] font-bold text-[#009688] transition-colors group-hover:text-[#00796b] sm:text-[0.82rem]">
                    <span className="sm:hidden">Explore</span>
                    <span className="hidden sm:inline">Explore Vertical Solution</span>
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#009688]/10 text-[#009688] transition-all duration-300 group-hover:bg-[#009688] group-hover:text-white group-hover:shadow-xs sm:h-7 sm:w-7">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── The shared spine — one core, tuned per vertical ──── */}
      <section className="border-y border-line bg-espresso text-card">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-accent-soft">
              One core, every vertical
            </p>
            <h2 className="mt-4 font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
              Whatever you sell, it runs on the same connected spine.
            </h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-card/70">
              Every industry above rides the same lead-to-ledger flow. We just tune the
              channel, the SKUs and the compliance to your vertical. Nothing re-keyed, no one
              working blind.
            </p>
          </div>

          {/* Connected spine rail with animated flow */}
          <div className="relative mt-14">
            <span className="pointer-events-none absolute left-0 right-0 top-6 hidden h-0.5 pipe-flow opacity-40 lg:block" />
            <ol className="relative grid grid-cols-2 gap-y-8 sm:grid-cols-4 lg:grid-cols-8 lg:gap-y-0">
              {flow.steps.map((step, i) => (
                <li key={step.label} className="flex flex-col items-center gap-3 text-center">
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-accent-soft">
                    <Icon name={step.icon} className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent font-mono text-[0.55rem] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <span className="text-[0.78rem] font-medium leading-tight text-card/80">
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-8 shadow-soft md:p-14">
          <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/12 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
                Don&rsquo;t see your exact vertical?
              </h2>
              <p className="mt-3 text-[1.02rem] leading-relaxed text-muted">
                KaySetu adapts to any sales-led, distribution-driven business. Tell us how you
                sell, and we&rsquo;ll model it on your real scenarios.
              </p>
            </div>
            <Link
              href="/contact"
              className="btn-primary group inline-flex shrink-0 items-center gap-2 rounded-xl px-7 py-3.5 text-[0.98rem] font-semibold"
            >
              Book a Free Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
