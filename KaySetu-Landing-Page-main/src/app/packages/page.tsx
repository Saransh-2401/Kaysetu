import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import {
  LeadsBoard,
  FieldMap,
  QuoteToCash,
  InventoryGrid,
  Dashboard,
  MobileApp,
} from "@/components/AppScreens";
import { packages, platformMenu } from "@/lib/content";
import CustomPackageBuilder from "./CustomPackageBuilder";

export const metadata: Metadata = {
  title: { absolute: "Packages & Pricing | KaySetu ERP + CRM Modules" },
  description:
    "Eight ready-made KaySetu packages — from a single module to the full enterprise suite — plus two add-ons you can attach to any of them. Pay only for the modules you use.",
  keywords: ["KaySetu packages", "ERP pricing", "CRM packages", "modular ERP", "field sales software pricing"],
  alternates: { canonical: "/packages" },
  openGraph: {
    title: "Packages & Pricing | KaySetu ERP + CRM Modules",
    description: "Eight ready-made packages plus two add-ons. Buy only the modules you run.",
    type: "website",
    images: ["/opengraph-image"],
    url: "/packages",
    siteName: "KaySetu",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Packages & Pricing | KaySetu ERP + CRM Modules",
    description: "Eight ready-made packages plus two add-ons. Buy only the modules you run.",
  },
};

const moduleRegistry = platformMenu.groups.flatMap((g) => g.links);
const byCode = Object.fromEntries(moduleRegistry.map((m) => [m.code, m]));
const allCodes = moduleRegistry.map((m) => m.code);

function codesFor(pkg: { modules: string[] }): string[] {
  return pkg.modules[0] === "ALL 11 MODULES" ? allCodes : pkg.modules;
}


/* Each card's thumbnail is the coded product screen closest to that package's
   daily use — the same mockups the modules walkthrough renders. */
const SCREENS: Record<string, () => React.ReactElement> = {
  P1: FieldMap,
  P2: MobileApp,
  P3: LeadsBoard,
  P4: QuoteToCash,
  P5: InventoryGrid,
  P6: QuoteToCash,
  P7: Dashboard,
  P8: Dashboard,
};

/* Hero ladder — the first four packages in order, so the sequence reads as a
   ladder with no skipped rungs. P3 carries the highlight (the popular pick).
   Notes stay under ~40 chars so the row never wraps. */
const LADDER: { code: string; note: string; featured?: boolean }[] = [
  { code: "P1", note: "Start with live tracking alone" },
  { code: "P2", note: "Beat plans, visits & orders" },
  { code: "P3", note: "The popular field-sales stack", featured: true },
  { code: "P4", note: "Orders, stock & distributors" },
];

const blurbs: Record<string, string> = {
  P1: "GPS attendance, live map and route replay — see the whole field force, live.",
  P2: "Beat plans, visits, orders, collections and targets, captured on the phone.",
  P3: "Tracking + field ops + CRM pipeline: lead to visit to order in one motion.",
  P4: "Orders, warehouse stock and distributors on one live ledger — no overpromising.",
  P5: "BOMs, work orders and job cards wired straight into live inventory.",
  P6: "Suppliers, POs and GRN receiving with three-way matching before payment.",
  P7: "Ledgers, invoices, payments and a GST hub that never needs re-keying.",
  P8: "Every module, one login, one record from first lead to ledger entry.",
};

/** Mini product-screen preview: the full coded screen rendered at half scale,
 *  framed and floating on a tinted backdrop, so each card opens on real UI. */
function Thumb({ code, featured = false }: { code: string; featured?: boolean }) {
  const Screen = SCREENS[code] ?? Dashboard;
  return (
    <div
      aria-hidden
      className={`relative h-48 overflow-hidden ${
        featured
          ? "bg-[radial-gradient(120%_100%_at_50%_0%,rgba(0,150,136,0.28),rgba(0,150,136,0.06)_65%,transparent)]"
          : "bg-[radial-gradient(120%_100%_at_50%_0%,rgba(0,150,136,0.12),rgba(0,150,136,0.02)_65%,transparent)]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-6 select-none transition-transform duration-500 ease-out group-hover:-translate-y-2">
        <div className="w-[200%] origin-top-left scale-50">
          <div className="overflow-hidden rounded-[22px] shadow-[0_24px_48px_-20px_rgba(16,35,75,0.4)] ring-1 ring-ink/10">
            <Screen />
          </div>
        </div>
      </div>
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t to-transparent ${
          featured ? "from-espresso" : "from-card"
        }`}
      />
    </div>
  );
}

export default function PackagesPage() {
  return (
    <PageShell>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-line">
        {/* Backdrop: paper wash, a soft accent glow behind the ladder card and
            a fine blueprint grid that fades out before the package cards. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-paper/60 to-transparent" />
          <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(16,35,75,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,35,75,0.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(75%_55%_at_50%_0%,#000,transparent)]" />
        </div>

        <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-16 md:pb-20 md:pt-24 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-accent">
                <span className="h-1 w-1 rounded-full bg-accent" />
                Packages &amp; Pricing
              </p>
              <h1 className="mt-4 font-display text-[2.3rem] font-bold leading-[1.02] tracking-tight balance md:text-[3.4rem]">
                Pick a package.<br />
                Pay for the modules<span className="text-accent"> you use.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted md:text-[1.12rem]">
                {packages.lead}{" "}No seats you don&rsquo;t need, no migration
                when you outgrow one — the next package is the same platform
                with more switched on.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/contact"
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[0.95rem] font-semibold"
                >
                  <Icon name="Calendar" className="h-4 w-4" strokeWidth={2} />
                  Get exact pricing
                </Link>
                <Link
                  href="/modules"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-6 py-3.5 text-[0.95rem] font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
                >
                  Explore all 11 modules
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6 text-[0.85rem] text-muted">
                {["Start with a single module", "Upgrade without migration", "Add-ons attach to any package"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="CheckCircle2" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Package ladder — four rungs from a single module to the full
                suite, each showing the modules it bundles. Mirrors the flow
                preview card on the /modules hero so the two pages rhyme. */}
            <div className="min-w-0">
              <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-float md:p-7">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <span className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                    <span className="flex h-2 w-2 rounded-full bg-accent" />
                    Packages P1–P8
                  </span>
                  <span className="rounded-full border border-line bg-paper px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
                    Same platform
                  </span>
                </div>

                <ol className="relative mt-5 space-y-3">
                  {LADDER.map(({ code, note, featured }, i, arr) => {
                    const p = packages.base.find((b) => b.code === code)!;
                    const codes = codesFor(p);
                    return (
                      <li key={code} className="relative flex gap-4">
                        {i < arr.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[1.375rem] top-11 h-[calc(100%-1.25rem)] w-px bg-line"
                          />
                        )}
                        <span
                          className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-mono text-[0.78rem] font-bold ${
                            featured
                              ? "border-accent bg-accent text-white shadow-[0_10px_20px_-10px_rgba(0,150,136,0.7)]"
                              : "border-line bg-paper text-accent"
                          }`}
                        >
                          {code}
                        </span>
                        <div className="min-w-0 flex-1 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-paper/60">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-display text-[0.98rem] font-bold text-ink">
                              <Amp text={p.name} />
                            </span>
                            <span className="flex shrink-0 items-center -space-x-1">
                              {codes.slice(0, 4).map((c) => (
                                <span
                                  key={c}
                                  title={byCode[c].label}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-accent ring-2 ring-card"
                                >
                                  <Icon name={byCode[c].icon} className="h-3 w-3" />
                                </span>
                              ))}
                              {codes.length > 4 && (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-ink font-mono text-[0.55rem] font-bold text-card ring-2 ring-card">
                                  +{codes.length - 4}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[0.82rem] text-muted">{note}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-[0.82rem] text-muted">
                    A1 · A2 add-ons attach to any package
                  </span>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-accent transition-transform hover:translate-x-0.5"
                  >
                    Get pricing
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Package cards P1–P8 ─────────────────────────────── */}
          <div className="mt-16 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 md:mt-24">
            <h2 className="font-display text-[1.6rem] font-bold tracking-tight text-ink md:text-[2rem]">
              Eight ready-made packages
            </h2>
            <p className="text-[0.9rem] text-muted">
              Every card lists the exact modules inside — click one to explore it.
            </p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {packages.base.map((p) => {
              const featured = "featured" in p && p.featured;
              const codes = codesFor(p);
              return (
                <article
                  key={p.code}
                  id={p.code.toLowerCase()}
                  className={`group relative flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
                    featured
                      ? "border-accent/50 bg-espresso text-card ring-1 ring-accent/30"
                      : "border-line bg-card hover:border-accent/40"
                  }`}
                >
                  <Thumb code={p.code} featured={!!featured} />

                  <div className="flex flex-1 flex-col p-6 pt-5">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[0.78rem] font-bold ${featured ? "text-accent-soft" : "text-accent"}`}>
                        {p.code}
                      </span>
                      {featured ? (
                        <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-wider text-white">
                          Everything
                        </span>
                      ) : (
                        p.code === "P3" && (
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-wider text-accent">
                            Popular
                          </span>
                        )
                      )}
                    </div>

                    <h3 className={`mt-2.5 font-display text-[1.2rem] font-bold leading-snug tracking-tight ${featured ? "text-card" : "text-ink group-hover:text-accent"} transition-colors`}>
                      <Amp text={p.name} />
                    </h3>
                    <p className={`mt-2 text-[0.84rem] leading-relaxed ${featured ? "text-card/65" : "text-muted"}`}>
                      {blurbs[p.code]}
                    </p>

                    {/* module composition */}
                    <div className="mt-5 flex flex-wrap items-center gap-1.5">
                      {featured ? (
                        <>
                          <span className="flex items-center -space-x-1">
                            {allCodes.slice(0, 6).map((c) => (
                              <span key={c} title={byCode[c].label} className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-ink text-accent-soft ring-2 ring-espresso">
                                <Icon name={byCode[c].icon} className="h-3 w-3" />
                              </span>
                            ))}
                          </span>
                          <span className="ml-1 font-mono text-[0.62rem] font-bold uppercase tracking-wider text-accent-soft">
                            All 11 modules
                          </span>
                        </>
                      ) : (
                        codes.map((c) => (
                          <Link
                            key={c}
                            href={byCode[c].href}
                            title={`${byCode[c].label} — ${byCode[c].desc}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:border-accent/50 hover:text-accent"
                          >
                            <Icon name={byCode[c].icon} className="h-3 w-3 text-accent" />
                            {c}
                          </Link>
                        ))
                      )}
                    </div>

                    <div className={`mt-auto flex items-center justify-between border-t ${featured ? "border-white/10" : "border-line-2"} pt-5 mt-6`}>
                      <Link
                        href="/contact"
                        className={`text-[0.85rem] font-bold transition-colors ${featured ? "text-accent-soft hover:text-accent" : "text-accent hover:text-[#00796b]"}`}
                      >
                        Get {p.code} pricing
                      </Link>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${featured ? "bg-accent text-white" : "bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white"}`}>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── Build-your-own custom package ───────────────────── */}
          <CustomPackageBuilder />

          {/* ── Add-ons A1 / A2 ─────────────────────────────────── */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {packages.addons.map((a) => {
              const m = byCode[a.modules[0]];
              return (
                <Link
                  key={a.code}
                  href={m.href}
                  className="group flex flex-1 items-center gap-3.5 rounded-2xl border border-dashed border-line bg-card/60 px-5 py-4 transition-colors hover:border-accent/50 hover:bg-card"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                    <Icon name={m.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[0.9rem] font-semibold text-ink">
                      {a.name}
                      <span className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-accent/70">
                        {a.code} · add-on
                      </span>
                    </span>
                    <span className="block truncate text-[0.78rem] text-faint">{m.desc}</span>
                  </span>
                  <span className="hidden shrink-0 font-mono text-[0.62rem] uppercase tracking-wider text-faint sm:block">
                    attach to any package
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              );
            })}
          </div>

          <p className="mt-6 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-faint">
            {packages.note}
          </p>
        </div>
      </section>

    </PageShell>
  );
}
