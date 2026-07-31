import type { Metadata } from "next";
import Image from "next/image";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import { AutoMedia } from "@/components/Motion";
import { contactPage } from "@/lib/content";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: { absolute: "Contact KaySetu — Book a free ERP + CRM demo | Kayease" },
  description:
    "Book a free, no-obligation demo of KaySetu, the unified ERP + CRM platform, or reach Kayease sales and support. We reply within one business day.",
  keywords: [
    "contact KaySetu",
    "book ERP CRM demo",
    "KaySetu demo",
    "Kayease contact",
    "field sales software demo",
    "GST ERP demo India",
  ],
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact KaySetu — Book a free demo",
    description:
      "Book a free demo of KaySetu, the unified ERP + CRM platform by Kayease. Sales, support and office details.",
    type: "website",
    url: "/contact",
  },
};

export default function ContactPage() {
  const p = contactPage;
  const { media } = p;

  return (
    <PageShell>
      {/* ── Hero — copy on the left, reassurance panel on the right ── */}
      <header className="border-b border-line">
        <div className="grid-lines mx-auto max-w-[1600px] px-5 py-14 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            {/* copy */}
            <div className="max-w-2xl">
              <h1 className="mt-4 font-display text-[2.1rem] font-bold leading-[1.05] tracking-tight balance md:text-[3.1rem]">
                {p.title}
              </h1>
              <p className="mt-5 text-[1.1rem] leading-relaxed text-muted">{p.lead}</p>
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {p.chips.map((c) => (
                  <li
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-[0.8rem] font-medium text-muted shadow-soft"
                  >
                    <Icon name="CheckCircle2" className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* reassurance panel */}
            <div className="rounded-3xl border border-line bg-card/70 p-2 shadow-float backdrop-blur-sm">
              <ul className="divide-y divide-line">
                {p.highlights.map((h) => (
                  <li key={h.title} className="flex items-start gap-4 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent">
                      <Icon name={h.icon} className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <div>
                      <div className="font-display text-[1.02rem] font-bold text-ink">{h.title}</div>
                      <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">{h.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      <section className="relative isolate mx-auto max-w-[1600px] px-5 py-16 md:py-20">
        {/* KaySetu "Setu" bridge + connected-workflow backdrop — decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-70 [mask-image:radial-gradient(120%_100%_at_50%_0%,#000_55%,transparent_100%)]"
          style={{ backgroundImage: "url(/contact-bg.svg)" }}
        />

        {/* Form (left) + product video (right) */}
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <ContactForm />

          {/* ── Product demo video card ── */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-accent/30 bg-espresso p-2 shadow-float">
            <div className="relative h-full min-h-[520px] overflow-hidden rounded-[1.35rem] bg-espresso">
              <AutoMedia
                src={media.video || undefined}
                poster={media.poster || undefined}
                className="absolute inset-0 h-full w-full object-cover"
              >
                {/* fallback when no video file is present */}
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-espresso text-center">
                  <Image
                    src="/logo2.png"
                    alt="KaySetu"
                    width={614}
                    height={224}
                    className="h-8 w-auto opacity-90"
                  />
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_40px_rgba(0,150,136,0.5)]">
                    <Icon name="Send" className="h-6 w-6 translate-x-[1px]" strokeWidth={1.8} />
                  </span>
                  <p className="max-w-[16rem] text-[0.85rem] text-white/60">
                    Drop a clip at <code className="text-white/80">/public/media/product-tour.mp4</code> to play it here.
                  </p>
                </div>
              </AutoMedia>

              {/* legibility scrim over the video */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-ink/40"
              />

              {/* top-left "now playing" badge */}
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {media.kicker}
              </div>

              {/* bottom caption */}
              <div className="absolute inset-x-5 bottom-5">
                <h3 className="font-display text-xl font-bold text-white">{media.title}</h3>
                <p className="mt-1.5 max-w-md text-[0.88rem] leading-relaxed text-white/70">
                  {media.caption}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick-contact cards ── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.quick.map((c) => {
            const inner = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                  <Icon name={c.icon} className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                    {c.label}
                  </div>
                  <div className="mt-0.5 truncate text-[0.95rem] font-semibold text-ink">
                    {c.value}
                  </div>
                </div>
              </>
            );

            const cls =
              "group flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-float";

            return c.href ? (
              <a key={c.label} href={c.href} className={cls}>
                {inner}
              </a>
            ) : (
              <div key={c.label} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
