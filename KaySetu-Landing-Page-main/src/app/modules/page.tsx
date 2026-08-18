import { Suspense } from "react";
import Link from "next/link";
import { modulePages } from "@/lib/modulePages";
import Amp from "@/components/Amp";
import { Reveal } from "@/components/Motion";
import Icon from "@/components/Icon";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ClosingCta from "@/components/ClosingCta";
import ModuleSwitcher from "./ModuleSwitcher";

/* Server component on purpose. The interactive switcher reads useSearchParams,
   which bails out to client rendering during prerender — when the whole page
   was one client component that bailout emptied the entire static HTML (no h1,
   no copy, no links). Keeping the page a server component confines the bailout
   to <ModuleSwitcher /> so the rest is crawlable. */
export default function ModulesHub() {
  return (
    <>
      <Nav />
      {/* No bottom padding: the page ends on <ClosingCta />, which hands straight
          over to the navy footer. Any padding here shows as a paper-coloured
          strip between the two bands. */}
      <main className="min-h-screen bg-paper">
        {/* Hero Section — the copy used to sit alone on a half-empty band, so
            it now shares the row with a preview of the field-to-ledger flow and
            carries its own entry points into the page. */}
        <section className="relative isolate overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
          {/* Custom Walkthrough Page Hero Background Artwork */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/walkthrough-hero-bg.png"
              alt=""
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_65%,rgba(0,0,0,0)_100%)]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-paper" />
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-full items-center gap-12 px-6 sm:px-10 lg:px-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <Reveal className="min-w-0">
              <span className="kicker">Interactive product tour</span>
              <h1 className="mt-4 mb-6 font-display text-4xl font-bold tracking-tight text-ink md:text-5xl balance">
                All 11 modules, <span className="text-accent">explored.</span>
              </h1>
              <p className="max-w-3xl text-lg text-muted md:text-xl balance">
                Dive deep into all 11 modules of the KaySetu platform, from agent
                live tracking to accounts &amp; finance. Select a module below to
                see exactly how it works.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/contact"
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[0.95rem] font-semibold"
                >
                  <Icon name="Calendar" className="h-4 w-4" strokeWidth={2} />
                  Book a Live Demo
                </Link>
                <Link
                  href="/industries"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-6 py-3.5 text-[0.95rem] font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
                >
                  View Vertical Solutions
                  <Icon name="ArrowRight" className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6 text-[0.85rem] text-muted">
                {["No sign-up required", "Real screens, real data", "GST-ready end to end"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="CheckCircle2" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </Reveal>

            {/* Flow preview — the first four modules in the order a real order
                travels through them, so the hero shows the point of the tour
                instead of leaving half the row empty. */}
            <Reveal delay={140} className="min-w-0">
              <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-float md:p-7">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <span className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                    <span className="flex h-2 w-2 rounded-full bg-accent" />
                    Module tour
                  </span>
                  <span className="rounded-full border border-line bg-paper px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
                    Field → ledger
                  </span>
                </div>

                <ol className="relative mt-5 space-y-3">
                  {modulePages.slice(0, 4).map((m, i, arr) => (
                    <li key={m.slug} className="relative flex gap-4">
                      {/* rail joining each step to the next */}
                      {i < arr.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[1.375rem] top-11 h-[calc(100%-1.25rem)] w-px bg-line"
                        />
                      )}
                      <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent">
                        <Icon name={m.icon} className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-paper/60">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-display text-[0.98rem] font-bold text-ink">
                            <Amp text={m.hero.title} />
                          </span>
                          <span className="font-mono text-[0.7rem] text-faint">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[0.82rem] text-muted">{m.hero.kicker}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-[0.82rem] text-muted">
                    All modules unified in one real-time system
                  </span>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-accent transition-transform hover:translate-x-0.5"
                  >
                    Get in touch
                    <Icon name="ArrowRight" className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="mx-auto max-w-[1600px] px-5 py-12 md:py-20">
          <Suspense
            fallback={<div className="min-h-[800px] rounded-2xl bg-card border border-line" />}
          >
            <ModuleSwitcher />
          </Suspense>
        </div>
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
