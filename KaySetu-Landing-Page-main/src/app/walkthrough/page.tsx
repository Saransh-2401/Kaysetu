import { Suspense } from "react";
import Link from "next/link";
import { modulePages } from "@/lib/modulePages";
import { Reveal } from "@/components/Motion";
import Icon from "@/components/Icon";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ModuleSwitcher from "./ModuleSwitcher";

/* Server component on purpose. The interactive switcher reads useSearchParams,
   which bails out to client rendering during prerender — when the whole page
   was one client component that bailout emptied the entire static HTML (no h1,
   no copy, no links). Keeping the page a server component confines the bailout
   to <ModuleSwitcher /> so the rest is crawlable. */
export default function WalkthroughHub() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-paper pb-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-surface pt-32 pb-16 md:pt-40 md:pb-24 border-b border-line">
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(0,150,136,0.1),transparent_70%)]" />
          <div className="relative z-10 mx-auto max-w-[1600px] px-5">
            <Reveal>
              <h1 className="mb-6 font-display text-4xl font-bold tracking-tight text-ink md:text-5xl balance">
                Interactive ERP + CRM Walkthroughs
              </h1>
              <p className="max-w-2xl text-lg text-muted md:text-xl balance">
                Dive deep into every module of the KaySetu platform — field sales,
                orders, inventory, production, procurement and GST accounts. Select
                a module below to see exactly how it works.
              </p>
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

        {/* Module directory — the switcher's sidebar swaps content with buttons,
            which crawlers can't follow. These are real links, so every
            /platform page has a route in from here. */}
        {/* bg-paper-2, not the `bg-surface` the rest of this page uses — there is
            no --color-surface token, so that class resolves to nothing. The
            slightly deeper band is what makes the white cards read as cards. */}
        <section className="border-t border-line bg-paper-2 py-16 md:py-24">
          <div className="mx-auto max-w-[1600px] px-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent">
                  Module directory
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
                  Every module, in depth
                </h2>
                <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-muted">
                  Each module has its own page covering how it works, what it
                  replaces and how it connects to the rest of the platform.
                </p>
              </div>
              {/* self-start, or the column layout on phones stretches the pill
                  to the full width of the header. */}
              <span className="shrink-0 self-start rounded-full border border-line bg-card px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-muted">
                {modulePages.length} modules
              </span>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modulePages.map((m) => (
                <Link
                  key={m.slug}
                  href={`/platform/${m.slug}`}
                  /* h-full so every card in a row matches the tallest lead, and
                     flex-col so the arrow rail always sits on the bottom edge
                     regardless of how many lines the lead wraps to. */
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-soft"
                >
                  {/* Teal wash that only blooms on hover — keeps the resting grid calm. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-[radial-gradient(ellipse_at_center,rgba(0,150,136,0.16),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <span className="relative flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                      <Icon name={m.icon} className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-faint transition-colors duration-300 group-hover:text-accent">
                      {m.hero.kicker}
                    </span>
                  </span>

                  <span className="relative mt-5 block font-display text-[1.15rem] font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-accent">
                    {m.hero.title}
                  </span>
                  <span className="relative mt-2 mb-5 block text-[0.875rem] leading-relaxed text-muted">
                    {m.hero.lead}
                  </span>

                  {/* mt-auto pins the rail to the bottom edge so the divider lines
                      up across a row even when one card's lead wraps further. */}
                  <span className="relative mt-auto flex items-center gap-1.5 border-t border-line-2 pt-4 font-medium text-[0.8rem] text-faint transition-colors duration-300 group-hover:text-accent">
                    Explore module
                    <Icon
                      name="ArrowRight"
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
