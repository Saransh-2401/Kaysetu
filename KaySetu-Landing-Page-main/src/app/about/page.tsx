import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PageShell, PageHeader } from "@/components/PageChrome";
import { aboutPage } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "About Kayease — The team behind KaySetu ERP + CRM" },
  description:
    "Kayease is the product studio behind KaySetu, a unified ERP + CRM for fast-moving Indian SMEs. Why we built one source of truth for sales, stock and accounts.",
  keywords: [
    "About Kayease",
    "KaySetu company",
    "ERP CRM startup India",
    "unified business platform",
    "Kayease product studio",
    "SME software India",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Kayease — The team behind KaySetu",
    description:
      "Why Kayease built KaySetu: one connected system for sales, field operations, inventory, production, procurement and accounts.",
    type: "website",
    url: "/about",
  },
};

export default function AboutPage() {
  const p = aboutPage;
  return (
    <PageShell>
      <PageHeader kicker={p.kicker} title={p.title} lead={p.lead} />

      {/* stats */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-px bg-line md:grid-cols-4">
          {p.stats.map((s) => (
            <div key={s.label} className="bg-paper px-5 py-8">
              <div className="font-display text-3xl font-bold text-accent">{s.value}</div>
              <div className="mt-2 text-[0.85rem] leading-snug text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* story */}
      <section className="mx-auto max-w-[1600px] px-5 py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
            {p.story.title}
          </h2>
          <div className="space-y-5 text-[1.02rem] leading-relaxed text-muted">
            {p.story.paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* values */}
      <section className="border-t border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-28">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {p.values.map((v) => (
              <div key={v.title} className="bg-paper p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-accent">
                  <Icon name={v.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-[1600px] px-5 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-espresso p-8 text-card sm:flex-row sm:items-center md:p-12">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">See your business, unified.</h2>
            <p className="mt-2 text-card/70">Book a free, no-obligation demo with the Kayease team.</p>
          </div>
          <Link
            href="/contact"
            className="btn-primary inline-flex items-center gap-1.5 rounded-full px-6 py-3 text-sm font-semibold"
          >
            <span className="text-white/90">▸</span> Book a Free Demo
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
