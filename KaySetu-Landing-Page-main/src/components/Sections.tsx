import { ArrowRight, ArrowUpRight, Check, Circle, X, Minus } from "lucide-react";
import Icon from "@/components/Icon";
import MagicBento from "@/components/MagicBento";
import {
  hero,
  trustBar,
  problem,
  flow,
  modules,
  packages,
  spotlights,
  operations,
  distributor,
  industries,
  socialProof,
  market,
  competitive,
  mobile,
  insights,
  usps,
  finalCta,
} from "@/lib/content";

/* ============================================================
   Shared primitives
   ============================================================ */

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto max-w-[1600px] px-5 py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}

function SectionHead({
  index,
  kicker,
  title,
  lead,
  dark = false,
  center = false,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  lead?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`max-w-3xl${center ? " mx-auto text-center" : ""}`}>
      <h2
        className={`font-display text-[1.9rem] font-bold leading-[1.08] tracking-tight balance md:text-[2.7rem] ${
          dark ? "text-card" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-5 text-[1.05rem] leading-relaxed ${center ? "mx-auto max-w-2xl " : ""}${
            dark ? "text-card/70" : "text-muted"
          }`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

const iconTile =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-accent shadow-soft";

/* ============================================================
   1 · Hero
   ============================================================ */

function HeroPanel() {
  return (
    <div className="animate-fade-up delay-2 relative">
      <div className="absolute -inset-6 -z-10 rounded-[34px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(0,150,136,0.22),transparent_70%)]" />
      <div className="shadow-float overflow-hidden rounded-[22px] border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
            {hero.panel.status}
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            {hero.panel.metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-line-2 bg-paper/60 p-3">
                <div className="font-display text-xl font-bold text-ink">{m.value}</div>
                <div className="mt-1 text-[0.68rem] leading-tight text-muted">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
              Connected pipeline
            </div>
            <div className="flex items-center justify-between">
              {hero.panel.flow.map((m, i) => (
                <div key={m.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-accent">
                      <Icon name={m.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-[0.6rem] text-muted">{m.label}</span>
                  </div>
                  {i < hero.panel.flow.length - 1 && (
                    <span className="mx-1 mb-4 h-px w-4 bg-line md:w-6" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
      <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 gap-12 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:pb-28">
        <div>
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 py-1.5">
            <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted">
              {hero.eyebrow}
            </span>
          </div>
          <h1 className="animate-fade-up delay-1 font-display text-[3rem] font-extrabold leading-[1.08] tracking-tight md:text-[4.4rem]">
            {hero.titleLead}
            <br />
            <span className="accent-box">{hero.titleAccent}</span>
          </h1>
          <p className="animate-fade-up delay-2 mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
            {hero.subhead}
          </p>
          <p className="animate-fade-up delay-2 mt-3 max-w-xl text-[0.9rem] italic text-faint">
            {hero.orbit}
          </p>
          <div className="animate-fade-up delay-3 mt-8 flex flex-wrap items-center gap-3">
            <a
              href={hero.primary.href}
              className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[0.98rem] font-semibold"
            >
              {hero.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={hero.secondary.href}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition hover:border-ink/25"
            >
              {hero.secondary.label}
            </a>
          </div>
          <div className="animate-fade-up delay-3 mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
            {hero.strip.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-sm text-muted">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                {s}
              </span>
            ))}
          </div>
        </div>
        <HeroPanel />
      </div>
    </section>
  );
}

/* ============================================================
   2 · Trust bar
   ============================================================ */

export function TrustBar() {
  return (
    <div className="border-b border-line bg-card/50">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        {trustBar.map((t) => (
          <div key={t.text} className="flex items-center gap-3 px-5 py-6">
            <Icon name={t.icon} className="h-5 w-5 shrink-0 text-accent" />
            <span className="text-[0.85rem] leading-tight text-muted">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   3 · Problem
   ============================================================ */

export function Problem() {
  return (
    <Section id="problem">
      <SectionHead index="01" kicker="The Problem" title={problem.title} lead={problem.intro} />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {problem.points.map((p, i) => (
          <div
            key={p.pain}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line/80 bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float"
          >
            {/* Top gradient accent line */}
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/20 via-accent to-accent/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                  <span className="h-2 w-2 rounded-full bg-current" />
                </span>
                <span className="font-mono text-[0.68rem] font-bold tracking-wider text-accent uppercase rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5">
                  0{i + 1}
                </span>
              </div>
              <p className="font-display text-[1.1rem] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
                {p.pain}
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-paper/60 p-3.5 text-[0.88rem] leading-relaxed text-muted transition-colors group-hover:border-accent/20 group-hover:bg-accent/5">
              <span className="font-semibold text-accent me-1.5">Impact:</span>
              {p.cost}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-2xl font-display text-xl font-semibold text-ink md:text-2xl">
        {problem.closing}
      </p>
    </Section>
  );
}

/* ============================================================
   4 · Connected flow
   ============================================================ */

export function ConnectedFlow() {
  return (
    <Section id="flow">
      <SectionHead index="02" kicker="One Connected Workflow" title={flow.title} lead={flow.body} />
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {flow.steps.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-line bg-card p-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper text-accent">
                <Icon name={s.icon} className="h-5 w-5" />
              </span>
              <span className="text-[0.78rem] font-medium leading-tight text-ink">{s.label}</span>
              <span className="font-mono text-[0.6rem] text-faint">0{i + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   5 · Modules (12)
   ============================================================ */

export function Modules() {
  return (
    <Section id="modules">
      <SectionHead index="03" kicker="What KaySetu Offers" title={modules.title} lead={modules.lead} />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {modules.items.map((m, idx) => (
          <div key={(m as any).code || m.name || idx} className="group flex gap-4 bg-card p-6 transition-colors hover:bg-paper/50">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent transition group-hover:border-accent/40">
              <Icon name={m.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                {(m as any).code && (
                  <span className="rounded-md bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] font-medium tracking-wider text-card">
                    {(m as any).code}
                  </span>
                )}
                <h3 className="font-display font-semibold leading-snug text-ink">{m.name}</h3>
              </div>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-muted">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   6 · Feature spotlights (CRM · Field · Orders)
   ============================================================ */

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}

export function Spotlights() {
  return (
    <>
      {spotlights.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <Section key={s.id} id={s.id}>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div className={flip ? "lg:order-2" : ""}>
                <div className="mb-5 flex items-center gap-3">
                  <span className={iconTile}>
                    <Icon name={s.icon} className="h-5 w-5" />
                  </span>
                </div>
                <h2 className="font-display text-[1.8rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
                  {s.title}
                </h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {s.roles.map((r) => (
                    <RoleBadge key={r} label={r} />
                  ))}
                </div>
              </div>
              <ul className={`divide-y divide-line-2 overflow-hidden rounded-2xl border border-line bg-card ${flip ? "lg:order-1" : ""}`}>
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 p-5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.4} />
                    <span className="text-[0.92rem] leading-relaxed text-ink">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        );
      })}
    </>
  );
}

/* ============================================================
   7 · Operations backbone
   ============================================================ */

export function Operations() {
  return (
    <Section id="operations">
      <SectionHead index="04" kicker="Operations Backbone" title={operations.title} lead={operations.lead} center />

      {/* Pipeline rail — the four stages moving in lock-step. `w-max` + auto
          margins centres the row while it fits and lets it scroll from the
          left edge once it doesn't (flex `justify-center` would strand the
          first stage outside the scrollable area). */}
      <div className="-mx-5 mt-12 overflow-x-auto px-5 pb-4 pt-4">
        <ol className="mx-auto flex w-max items-center">
          {operations.cards.map((c, i) => (
            <li key={c.code} className="flex items-center">
              <div className="group relative flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_38px_-24px_rgba(0,150,136,0.55)]">
                <span className="absolute -top-2 left-4 rounded-full border border-line bg-paper px-1.5 font-mono text-[0.55rem] font-semibold leading-4 tracking-[0.18em] text-faint transition-colors duration-300 group-hover:border-accent/40 group-hover:text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent transition-all duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-white group-hover:shadow-[0_8px_18px_-8px_rgba(0,150,136,0.6)]">
                  <Icon name={c.icon} className="h-4 w-4" />
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="font-mono text-[0.68rem] font-semibold tracking-[0.14em] text-ink">{c.code}</span>
                  <span className="mt-0.5 whitespace-nowrap text-[0.72rem] text-muted">{c.name}</span>
                </span>
              </div>

              {i < operations.cards.length - 1 && (
                <span className="mx-2 flex shrink-0 items-center gap-1 sm:mx-3" aria-hidden>
                  <span className="pipe-flow h-0.5 w-7 rounded-full opacity-60 sm:w-12" />
                  <ArrowRight className="h-3.5 w-3.5 text-accent/70" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8">
        <MagicBento cards={operations.cards} />
      </div>
    </Section>
  );
}

/* ============================================================
   8 · Distributor network
   ============================================================ */

export function Distributor() {
  return (
    <Section id="distributor">
      <div className="overflow-hidden rounded-3xl border border-line bg-card p-8 md:p-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className={iconTile}>
                <Icon name="Share2" className="h-5 w-5" />
              </span>
            </div>
            <h2 className="font-display text-[1.8rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.3rem]">
              {distributor.title}
            </h2>
            <p className="mt-5 text-[1.02rem] leading-relaxed text-muted">{distributor.body}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:content-center">
            {distributor.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 rounded-xl border border-line-2 bg-paper/50 p-4 text-[0.88rem] leading-relaxed text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
   9 · Mobile (dark)
   ============================================================ */

export function Mobile() {
  return (
    <div className="bg-espresso">
      <Section id="mobile">
        <SectionHead index="06" kicker={mobile.kicker} title={mobile.title} lead={mobile.body} dark />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {mobile.features.map((f) => (
            <div key={f.title} className="bg-espresso p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-accent-soft">
                <Icon name={f.icon} className="h-5 w-5" />
              </span>
              <p className="font-semibold text-card">{f.title}</p>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-card/55">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ============================================================
   10 · Insights
   ============================================================ */

export function Insights() {
  return (
    <Section id="insights">
      <SectionHead index="07" kicker={insights.kicker} title={insights.title} lead={insights.body} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {insights.domains.map((d) => (
          <div key={d.name} className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center gap-3">
              <span className={iconTile}>
                <Icon name={d.icon} className="h-5 w-5" />
              </span>
              <h3 className="font-display font-semibold text-ink">{d.name}</h3>
            </div>
            <ul className="mt-5 space-y-2.5">
              {d.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[0.86rem] text-muted">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-2xl border-l-2 border-accent pl-4 font-display text-lg font-medium italic text-ink">
        {insights.quote}
      </p>
    </Section>
  );
}

/* ============================================================
   Industries
   ============================================================ */

export function Industries() {
  return (
    <Section id="industries">
      <SectionHead index="05" kicker="Industries" title={industries.title} lead={industries.lead} />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {industries.items.map((it) => (
          <div key={it.name} className="group flex items-center gap-3 bg-card p-5 transition-colors hover:bg-paper/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent transition group-hover:border-accent/40">
              <Icon name={it.icon} className="h-5 w-5" />
            </span>
            <span className="text-[0.9rem] font-medium leading-tight text-ink">{it.name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   Social proof
   ============================================================ */

export function SocialProof() {
  return (
    <Section id="proof">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <h2 className="font-display text-[1.8rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.3rem]">
            {socialProof.title}
          </h2>
          <p className="mt-5 text-[1.02rem] leading-relaxed text-muted">{socialProof.lead}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {socialProof.results.map((r) => (
            <div key={r.label} className="rounded-2xl border border-line bg-card p-6">
              <div className="font-display text-3xl font-extrabold tracking-tight text-accent">{r.stat}</div>
              <p className="mt-3 text-[0.82rem] leading-relaxed text-muted">{r.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer stories — replace bracketed text with real quotes */}
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {socialProof.testimonials.map((t) => (
          <figure key={t.tag} className="flex flex-col rounded-2xl border border-line bg-card p-6">
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-accent">{t.tag}</span>
            <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-ink">
              {t.quote}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-line-2 pt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-sm text-accent">
                ★
              </span>
              <div>
                <div className="text-[0.82rem] font-semibold text-ink">{t.name}</div>
                <div className="text-[0.72rem] text-muted">{t.role}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   Logo cloud (under hero)
   ============================================================ */

export function LogoCloud() {
  return (
    <div className="border-b border-line bg-paper">
      <div className="mx-auto max-w-[1600px] px-5 py-9">
        <p className="text-center font-mono text-[0.66rem] uppercase tracking-wider text-faint">
          {socialProof.logosNote}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line-2 bg-line-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: socialProof.logos }).map((_, i) => (
            <div
              key={i}
              className="flex h-16 items-center justify-center bg-paper text-[0.68rem] font-medium uppercase tracking-wider text-faint/50"
            >
              Logo
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Market
   ============================================================ */

export function Market() {
  return (
    <Section id="market">
      <SectionHead index="08" kicker="The Opportunity" title={market.title} />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {market.stats.map((s) => (
          <a
            key={s.label}
            href={s.source}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col bg-card p-6 transition-colors hover:bg-paper/60"
          >
            <div className="font-display text-3xl font-extrabold tracking-tight text-accent">{s.value}</div>
            <p className="mt-3 flex-1 text-[0.84rem] leading-relaxed text-muted">{s.label}</p>
            <span className="mt-4 flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-faint transition-colors group-hover:text-accent">
              Source <ArrowUpRight className="h-3 w-3" />
            </span>
          </a>
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-[1.05rem] leading-relaxed text-ink">{market.framing}</p>
    </Section>
  );
}

/* ============================================================
   Competitive positioning
   ============================================================ */

function Verdict({ v }: { v: string }) {
  if (v === "yes") return <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.4} />;
  if (v === "no") return <X className="h-4 w-4 text-accent/60" strokeWidth={2.4} />;
  return <Minus className="h-4 w-4 text-faint" strokeWidth={2.4} />;
}

export function Competitive() {
  return (
    <Section id="compare">
      <SectionHead index="09" kicker="How KaySetu Compares" title={competitive.title} lead={competitive.lead} />
      <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {competitive.columns.map((c, i) => (
                <th
                  key={i}
                  className={`p-4 text-left align-bottom ${i === 1 ? "bg-accent/[0.07]" : ""}`}
                >
                  <span className={`block font-semibold ${i === 1 ? "text-accent" : "text-ink"}`}>
                    {c.label}
                  </span>
                  {c.eg && (
                    <span className="mt-0.5 block font-mono text-[0.6rem] font-normal uppercase tracking-wide text-faint">
                      {c.eg}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competitive.rows.map((row) => (
              <tr key={row.k} className="border-b border-line-2 last:border-0">
                <td className="p-4 font-medium text-ink">{row.k}</td>
                {row.cells.map((cell, i) => (
                  <td key={i} className={`p-4 ${i === 0 ? "bg-accent/[0.05]" : ""}`}>
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5">
                        <Verdict v={cell.v} />
                      </span>
                      <span className={i === 0 ? "font-medium text-ink" : "text-muted"}>{cell.t}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <blockquote className="mx-auto mt-12 max-w-3xl text-center font-display text-xl font-semibold leading-snug text-ink md:text-2xl">
        <span className="text-accent">“</span>
        {competitive.quote}
        <span className="text-accent">”</span>
      </blockquote>
    </Section>
  );
}

/* ============================================================
   Packages / Pricing
   ============================================================ */

function ModuleChips({ codes }: { codes: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {codes.map((c) => (
        <span
          key={c}
          className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[0.6rem] font-medium tracking-wider text-muted"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function Packages() {
  return (
    <Section id="packages">
      <SectionHead index="10" kicker="Packages & Pricing" title={packages.title} lead={packages.lead} />

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {packages.base.map((p) => {
          const featured = "featured" in p && p.featured;
          return (
            <div
              key={p.code}
              className={`flex flex-col p-6 transition-colors ${
                featured ? "bg-espresso" : "bg-card hover:bg-paper/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[0.7rem] font-medium tracking-wider ${
                    featured ? "text-accent-soft" : "text-accent"
                  }`}
                >
                  {p.code}
                </span>
                {featured && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white">
                    Everything
                  </span>
                )}
              </div>
              <h3 className={`mt-2 font-display text-lg font-bold ${featured ? "text-card" : "text-ink"}`}>
                {p.name}
              </h3>
              <ModuleChips codes={p.modules} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr] lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col justify-center rounded-2xl border border-line bg-card p-6">
          <p className="font-mono text-[0.66rem] uppercase tracking-wider text-faint">Add-ons</p>
          <p className="mt-2 text-[0.9rem] text-muted">
            Attach to any package. {packages.note}
          </p>
        </div>
        {packages.addons.map((a) => (
          <div key={a.code} className="rounded-2xl border border-dashed border-line bg-paper/40 p-6">
            <span className="font-mono text-[0.7rem] font-medium tracking-wider text-accent">{a.code}</span>
            <h3 className="mt-2 font-display text-lg font-bold text-ink">{a.name}</h3>
            <ModuleChips codes={a.modules} />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a
          href={packages.cta.href}
          className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[0.95rem] font-semibold"
        >
          {packages.cta.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
        <span className="text-sm text-muted">{packages.note}</span>
      </div>
    </Section>
  );
}

/* ============================================================
   11 · Why KaySetu (USPs)
   ============================================================ */

export function USPs() {
  return (
    <Section id="why">
      <SectionHead index="11" kicker="Why KaySetu" title="Six reasons teams switch to KaySetu." />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {usps.map((u) => (
          <div key={u.title} className="bg-card p-6">
            <span className={iconTile}>
              <Icon name={u.icon} className="h-5 w-5" />
            </span>
            <p className="mt-4 font-semibold text-ink">{u.title}</p>
            <p className="mt-1.5 text-[0.9rem] text-muted">{u.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   13 · Final CTA
   ============================================================ */

export function FinalCta() {
  return (
    <Section id="demo">
      <div className="relative overflow-hidden rounded-[28px] bg-espresso px-6 py-16 text-center md:px-12 md:py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent/12 to-transparent" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight text-card balance md:text-5xl">
            {finalCta.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-card/65">
            {finalCta.body}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a
              href={finalCta.primary.href}
              className="btn-primary group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.98rem] font-semibold"
            >
              {finalCta.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={finalCta.secondary.href}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-[0.98rem] font-semibold text-card transition hover:bg-white/10"
            >
              {finalCta.secondary.label}
            </a>
          </div>
          <p className="mt-8 font-mono text-[0.72rem] uppercase tracking-wider text-card/40">
            {finalCta.reassurance}
          </p>
        </div>
      </div>
    </Section>
  );
}
