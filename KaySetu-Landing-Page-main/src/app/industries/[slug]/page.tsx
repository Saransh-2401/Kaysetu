import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import { Reveal } from "@/components/Motion";
import { industryPages, industryBySlug, type IndustryPage } from "@/lib/content";

const BASE = "https://kaysetu.kayease.com";

// Only the eight known industries render; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return industryPages.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) return {};
  const url = `/industries/${ind.slug}`;
  return {
    title: { absolute: ind.seo.title },
    description: ind.seo.description,
    keywords: ind.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: ind.seo.title,
      description: ind.seo.description,
      type: "website",
      url,
      siteName: "KaySetu",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: ind.seo.title,
      description: ind.seo.description,
    },
  };
}

/* ── Signature hero panel — a live "workflow snapshot" for the vertical ── */
function HeroPanel({ ind }: { ind: IndustryPage }) {
  return (
    <Reveal className="relative" delay={140}>
      {/* radial aura + drifting ghost icon */}
      <div className="absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(60%_60%_at_72%_18%,rgba(0,150,136,0.2),transparent_70%)] aura-pulse" />
      <span className="pointer-events-none absolute -right-6 -top-10 -z-10 text-accent/[0.06] ghost-drift">
        <Icon name={ind.icon} className="h-52 w-52" strokeWidth={1} />
      </span>

      <div className="shadow-float overflow-hidden rounded-[22px] border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-wider text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" />
            Live · Real-time
          </span>
        </div>

        <div className="p-5">
          {/* stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            {ind.hero.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line-2 bg-paper/60 p-3">
                <div className="font-display text-[0.95rem] font-bold leading-tight text-accent">
                  {s.value}
                </div>
                <div className="mt-1 text-[0.66rem] leading-tight text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {/* compact connected pipeline */}
          <div className="mt-5">
            <div className="mb-2.5 font-mono text-[0.64rem] uppercase tracking-wider text-faint">
              Connected workflow
            </div>
            <div className="flex items-center justify-between">
              {ind.workflow.steps.map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                        i === 0
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-paper text-accent"
                      }`}
                    >
                      <Icon name={step.icon} className="h-4 w-4" />
                    </span>
                  </div>
                  {i < ind.workflow.steps.length - 1 && (
                    <span className="mx-0.5 h-px w-3 bg-line sm:w-4" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) notFound();

  const others = industryPages.filter((i) => i.slug !== ind.slug);
  const [featCap, ...restCaps] = ind.capabilities.cards;

  // Per-page structured data: FAQ rich results + breadcrumb trail.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE },
          { "@type": "ListItem", position: 2, name: "Industries", item: `${BASE}/industries` },
          { "@type": "ListItem", position: 3, name: ind.name, item: `${BASE}/industries/${ind.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: ind.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
        <div className="relative mx-auto grid max-w-[1600px] gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <div>
            <nav className="mb-6 flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-faint">
              <Link href="/" className="transition-colors hover:text-accent">Home</Link>
              <span>/</span>
              <Link href="/industries" className="transition-colors hover:text-accent">Industries</Link>
            </nav>

            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[0.8rem] font-semibold text-ink shadow-soft">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon name={ind.icon} className="h-3.5 w-3.5" />
              </span>
              {ind.eyebrow}
            </span>

            <h1 className="mt-6 font-display text-[2.2rem] font-bold leading-[1.02] tracking-tight balance md:text-[3.5rem]">
              {ind.hero.title}{" "}
              <span className="text-accent">{ind.hero.titleAccent}</span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
              {ind.hero.subhead}
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
                href="/#walkthrough"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-paper"
              >
                See the walkthrough
              </Link>
            </div>
          </div>

          <HeroPanel ind={ind} />
        </div>
      </header>

      {/* ── Challenges — the "cold" cost ledger (desaturated on purpose) ── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="max-w-3xl">
            <h2 className="mt-4 font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
              {ind.challenges.title}
            </h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-muted">
              {ind.challenges.intro}
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ind.challenges.items.map((it, i) => (
              <Reveal
                key={it.pain}
                delay={(i % 3) * 70}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper p-6 transition-colors hover:border-ink/20"
              >
                <span className="pointer-events-none absolute -right-3 -top-5 select-none font-display text-[4.5rem] font-extrabold leading-none text-ink/[0.04]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-faint">
                  <span className="h-2 w-2 rounded-full bg-faint" />
                </span>
                <p className="relative mt-4 font-display text-base font-bold leading-snug text-ink">
                  {it.pain}
                </p>
                <div className="relative my-4 h-px w-full bg-line" />
                <p className="relative flex items-start gap-2 text-[0.9rem] leading-relaxed text-muted">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-faint" />
                  {it.impact}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities — the "alive" teal solution (asymmetric bento) ── */}
      <section className="border-b border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="max-w-3xl">
            <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
              {ind.capabilities.title}
            </h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-muted">
              {ind.capabilities.lead}
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Featured capability */}
            <Reveal className="relative flex flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card to-paper p-8 shadow-soft">
              <span className="pointer-events-none absolute -right-8 -top-8 text-accent/[0.06]">
                <Icon name={featCap.icon} className="h-48 w-48" strokeWidth={1} />
              </span>
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-ink text-white shadow-soft">
                <Icon name={featCap.icon} className="h-6 w-6" />
              </span>
              <span className="relative mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-wider text-accent">
                Signature capability
              </span>
              <h3 className="relative mt-4 font-display text-2xl font-bold leading-tight text-ink">
                {featCap.name}
              </h3>
              <p className="relative mt-3 text-[0.98rem] leading-relaxed text-muted">
                {featCap.desc}
              </p>
              <div className="relative mt-auto flex items-center gap-2 pt-8 font-mono text-[0.66rem] uppercase tracking-wider text-faint">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                One connected system
              </div>
            </Reveal>

            {/* Remaining capabilities */}
            <div className="grid gap-5 sm:grid-cols-2">
              {restCaps.map((c, i) => (
                <Reveal
                  key={c.name}
                  delay={(i % 2) * 70}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-float ${
                    i === restCaps.length - 1 ? "sm:col-span-2" : ""
                  }`}
                >
                  <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-accent to-accent-soft transition-transform duration-300 group-hover:scale-x-100" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                    <Icon name={c.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">{c.name}</h3>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">{c.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow — the connected pipeline (centerpiece) ──── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="max-w-3xl">
            <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
              {ind.workflow.title}
            </h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-muted">
              {ind.workflow.lead}
            </p>
          </div>

          <div className="relative mt-14">
            {/* animated rail behind the nodes (desktop) */}
            <div className="pointer-events-none absolute inset-x-[8%] top-8 hidden lg:block">
              <div className="h-0.5 w-full rounded-full bg-line" />
              <div className="-mt-0.5 h-0.5 w-full rounded-full pipe-flow opacity-30" />
            </div>

            <ol className="relative grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-2">
              {ind.workflow.steps.map((step, i) => (
                <li key={step.label} className="flex flex-col items-center gap-3 text-center">
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-card text-accent shadow-soft transition-transform duration-300 hover:-translate-y-1 hover:border-accent/40">
                    <Icon name={step.icon} className="h-6 w-6" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[0.6rem] font-bold text-white shadow-soft">
                      {i + 1}
                    </span>
                  </span>
                  <span className="max-w-[8rem] text-[0.82rem] font-semibold leading-snug text-ink">
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-line bg-card p-8 shadow-soft md:p-14">
            <span className="pointer-events-none absolute left-6 top-2 select-none font-display text-[7rem] font-black leading-none text-accent/10 md:text-[9rem]">
              &ldquo;
            </span>
            <figure className="relative text-center">
              <blockquote className="font-display text-[1.4rem] font-semibold leading-[1.4] tracking-tight balance text-ink md:text-[1.9rem]">
                {ind.testimonial.quote}
              </blockquote>
              <figcaption className="mt-8 flex items-center justify-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-ink font-display text-sm font-bold text-white shadow-soft">
                  {ind.testimonial.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="text-left">
                  <div className="text-[0.9rem] font-semibold text-ink">
                    {ind.testimonial.name}
                  </div>
                  <div className="text-[0.82rem] text-muted">
                    {ind.testimonial.role} · {ind.testimonial.company}
                  </div>
                </div>
              </figcaption>
              <p className="mt-6 font-mono text-[0.66rem] uppercase tracking-wider text-faint">
                Illustrative outcome — named customer stories published as we onboard.
              </p>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-32 lg:self-start max-w-md">
              <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
                {ind.name} questions, answered.
              </h2>
              <p className="mt-5 text-[1.02rem] leading-relaxed text-muted">
                Everything teams ask before a demo.
              </p>

              {/* Talk to us CTA */}
              <div className="mt-8 relative overflow-hidden rounded-2xl bg-[#0b111a] p-6 flex flex-col gap-5 border border-[#1e2a3a] shadow-xl">
                <div
                  className="absolute left-0 top-0 w-full h-full opacity-[0.12] pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18202b] border border-[#232d3b]">
                    <svg className="h-5 w-5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[1.05rem] font-bold text-white tracking-tight">Still have questions?</h3>
                    <p className="mt-1 text-[0.85rem] leading-relaxed text-[#8e9bae]">
                      Our support team is ready to help you.
                    </p>
                  </div>
                </div>
                <Link
                  href="/contact"
                  className="relative z-10 group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#232d3b] bg-[#141b26] px-4 py-2.5 text-[0.9rem] font-semibold text-[#3b82f6] transition hover:bg-[#1a2230]"
                >
                  Talk to us
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {ind.faqs.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-[1rem] font-semibold text-ink transition-colors group-open:text-accent">
                    {f.q}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-accent transition-transform duration-200 group-open:rotate-45 group-open:border-accent">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[0.94rem] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Other industries ─────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-16 md:py-20">
          <div className="flex items-end justify-between">
            <h3 className="text-lg font-bold text-ink">Explore other industries</h3>
            <Link
              href="/industries"
              className="hidden text-[0.85rem] font-semibold text-accent transition hover:translate-x-0.5 sm:inline-flex sm:items-center sm:gap-1"
            >
              All industries <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-7">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/industries/${o.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-soft"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                  <Icon name={o.icon} className="h-5 w-5" />
                </span>
                <span className="text-[0.85rem] font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
                  {o.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA (dark) ───────────────────────────────────────── */}
      <section className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-espresso p-8 text-card md:p-14">
          <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold leading-tight md:text-[2.2rem]">
                {ind.cta.title}
              </h2>
              <p className="mt-3 text-card/70">{ind.cta.body}</p>
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
