import { ArrowRight, Check, Contact, Navigation, ShoppingCart } from "lucide-react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import AppDownloadButton from "@/components/AppDownloadButton";
import { Reveal, Counter } from "@/components/Motion";
import PhoneMockupBasic from "@/components/ui/phone-mockups-1";
import {
  problemShift,
  stats,
  productReveal,
  builtFor,
  toolbox,
  closing,
} from "@/lib/content";

/* ================= Problem → Shift ================= */
export function ProblemShift() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
      <Reveal delay={60}>
        <p className="font-display text-2xl font-semibold leading-snug text-faint balance md:text-[2.1rem]">
          <Amp text={problemShift.old} />
        </p>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 font-display text-2xl font-bold leading-snug text-ink balance md:text-[2.1rem]">
          <Amp text={problemShift.new} />
        </p>
      </Reveal>
    </section>
  );
}

/* ================= Stat bar ================= */
export function StatBar() {
  return (
    <section className="border-y border-line bg-card/50">
      <div className="mx-auto max-w-[1600px] px-5 py-16">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {stats.items.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="bg-paper px-6 py-10 text-center">
              <div className="font-display text-[3rem] font-extrabold leading-none tracking-tight text-accent md:text-[3.6rem]">
                <Counter value={s.value} suffix={s.suffix} />
              </div>
              <p className="mx-auto mt-3 max-w-[17rem] text-[0.9rem] leading-snug text-muted">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= Mobile agent app ================= */

/* Feature notes that used to be absolutely-positioned cards floating either
   side of a single phone. A centred carousel has no free gutter to hang them
   in, so they read as a row underneath instead. */
const agentAppHighlights = [
  {
    icon: Check,
    tint: "bg-emerald-100 text-emerald-600",
    kicker: "Feature",
    title: "GPS Verified",
    body: "Check-ins are stamped with location, so a visit log is proof, not a claim.",
  },
  {
    icon: ShoppingCart,
    tint: "bg-orange-100 text-orange-600",
    kicker: "Live sync",
    title: "Instant Orders",
    body: "Orders push straight into the ERP without a round of manual entry.",
  },
  {
    icon: Navigation,
    tint: "bg-blue-100 text-blue-600",
    kicker: "Live",
    title: "Route Tracking",
    body: "Follow the beat plan as it happens, and replay any route later.",
  },
  {
    icon: Contact,
    tint: "bg-purple-100 text-purple-600",
    kicker: "CRM",
    title: "Lead Capture",
    body: "A single structured pipeline for every lead, so nothing is lost in WhatsApp.",
  },
];

export function ProductReveal() {
  return (
    <section id="workspace" className="relative overflow-hidden bg-[#fbfbf9] py-20 md:py-28">
      {/* Banner background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <img
          src="/map-bg.png"
          alt=""
          aria-hidden
          className="h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#fbfbf9] via-[#fbfbf9]/40 to-[#fbfbf9]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-5">
        {/* ── Centred header ────────────────────────────────── */}
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal delay={0} className="flex flex-col items-center">
            <img
              src="/logo2.png"
              alt="KaySetu"
              className="mb-6 h-8 w-auto drop-shadow-sm md:h-11"
            />
          </Reveal>

          <Reveal delay={100}>
            <h2 className="mb-4 font-display text-[2.2rem] font-extrabold leading-tight tracking-tight text-slate-900 md:text-[3.5rem]">
              Mobile agent app
            </h2>
          </Reveal>

          <Reveal delay={200}>
            <p className="mb-8 text-base font-medium leading-relaxed text-slate-600 md:text-lg">
              Empower your field force with a unified mobile experience. Say goodbye to
              scattered WhatsApp updates and delayed end-of-day reports.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <AppDownloadButton />
          </Reveal>
        </div>

        {/* ── Phone carousel ────────────────────────────────── */}
        <Reveal delay={400} className="mt-14 md:mt-16">
          <PhoneMockupBasic />
        </Reveal>

        {/* ── Highlights ────────────────────────────────────── */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-4">
          {agentAppHighlights.map((item, i) => (
            <Reveal
              key={item.title}
              delay={500 + i * 90}
              className="rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.tint}`}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-medium text-slate-400">{item.kicker}</span>
                  <span className="text-sm font-bold text-slate-800">{item.title}</span>
                </div>
              </div>
              <p className="mt-3 text-[0.78rem] leading-relaxed text-slate-500">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= Built for (segments) ================= */
export function BuiltFor() {
  return (
    <section id="built-for" className="mx-auto max-w-[1600px] px-5 py-20 md:py-28">
      <Reveal className="max-w-3xl">
        <h2 className="font-display text-[1.9rem] font-bold leading-[1.08] tracking-tight balance md:text-[2.7rem]">
          <Amp text={builtFor.title} />
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {builtFor.tiles.map((tile, i) => (
          <Reveal
            key={tile.tag}
            delay={i * 80}
            className="flex flex-col rounded-2xl border border-line bg-card p-7 transition-colors hover:border-accent/30"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon name={tile.icon} className="h-6 w-6" />
            </span>
            <span className="mt-5 font-mono text-[0.62rem] uppercase tracking-wider text-accent">
              {tile.tag}
            </span>
            <h3 className="mt-1 font-display text-xl font-bold leading-tight"><Amp text={tile.title} /></h3>
            <ul className="mt-4 space-y-2">
              {tile.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[0.9rem] text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.4} />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= Toolbox / integrations (restrained static strip) ================= */
export function Toolbox() {
  return (
    <section className="border-y border-line bg-card/40 py-16">
      <div className="mx-auto max-w-[1600px] px-5">
        <Reveal className="text-center">
          <h2 className="font-display text-[1.6rem] font-bold tracking-tight balance md:text-[2rem]">
            <Amp text={toolbox.title} />
          </h2>
        </Reveal>
        <Reveal delay={80} className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {toolbox.tools.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink/70"
            >
              {t}
            </span>
          ))}
        </Reveal>
        <p className="mt-5 text-center text-[0.72rem] text-faint">{toolbox.note}</p>
      </div>
    </section>
  );
}

/* ================= Closing CTA ================= */
export function ClosingCta() {
  return (
    <section id="demo" className="relative overflow-hidden bg-espresso">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_0%,rgba(0,150,136,0.1),transparent_70%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
        <Reveal>
          <h2 className="display-xl text-[2.2rem] leading-[1] text-card sm:text-[3rem] md:text-[3.8rem]">
            {closing.line}
            <br />
            <span className="text-accent-soft">{closing.lineAccent}</span>
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-card/70">
            {closing.body}
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={closing.primary.href}
              className="btn-primary group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.98rem] font-semibold"
            >
              {closing.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={closing.secondary.href}
              className="inline-flex items-center gap-2 rounded-full border border-card/25 px-6 py-3.5 text-[0.98rem] font-semibold text-card transition hover:bg-card/10"
            >
              {closing.secondary.label}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
