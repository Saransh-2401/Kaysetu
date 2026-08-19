import type { Metadata } from "next";
import Image from "next/image";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import { AutoMedia, Reveal } from "@/components/Motion";
import { contactPage } from "@/lib/content";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: { absolute: "Contact KaySetu: Book a free ERP + CRM demo | Kayease" },
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
    title: "Contact KaySetu: Book a free demo",
    description:
      "Book a free demo of KaySetu, the unified ERP + CRM platform by Kayease. Sales, support and office details.",
    type: "website",
    images: ["/opengraph-image"],
    url: "/contact",
  },
};

export default function ContactPage() {
  const p = contactPage;
  const { media, faq } = p;

  return (
    <PageShell cta={false}>
      {/* Hero removed - the page opens on the enquiry form, whose heading is
          now the page's h1 (see ContactForm). */}
      {/* The section itself is full-bleed so the decorative backdrop runs edge
          to edge; the content inside is capped, still narrower than the 1600px
          the rest of the page uses so the form fields keep a comfortable line
          length. Previously the backdrop was pinned to the capped box, so the
          SVG's grid lines ended in a hard rectangle mid-page. */}
      <section id="enquiry" className="relative isolate scroll-mt-28 overflow-hidden">
        {/* KaySetu "Setu" bridge + connected-workflow backdrop - decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-70 [mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)]"
          style={{ backgroundImage: "url(/contact-bg.svg)" }}
        />

        <div className="mx-auto max-w-[1360px] px-5 py-12 md:px-8 md:py-16">
          {/* Form (left) + product video (right) */}
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <ContactForm />

            {/* ── Product demo video card ── */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-accent/30 bg-espresso p-2 shadow-float">
              <div className="relative h-full min-h-[400px] overflow-hidden rounded-[1.35rem] bg-espresso">
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
                  <h3 className="font-display text-xl font-bold text-white"><Amp text={media.title} /></h3>
                  <p className="mt-1.5 max-w-md text-[0.88rem] leading-relaxed text-white/70">
                    {media.caption}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick-contact cards ── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.quick.map((c, i) => {
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
                  {c.href && (
                    <Icon
                      name="ArrowRight"
                      className="ml-auto h-4 w-4 shrink-0 text-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  )}
                </>
              );

              const cls =
                "group flex h-full items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-float";

              return (
                <Reveal key={c.label} delay={i * 70}>
                  {c.href ? (
                    <a href={c.href} className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contact FAQ - no client JS, native details/summary ── */}
      <section className="border-t border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <Reveal className="lg:sticky lg:top-32 lg:self-start">
              <span className="kicker">{faq.kicker}</span>
              <h2 className="mt-3 font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
                <Amp text={faq.title} />
              </h2>
              <p className="mt-4 max-w-sm text-[1.02rem] leading-relaxed text-muted">{faq.lead}</p>
            </Reveal>

            <div className="flex flex-col gap-3">
              {faq.items.map((item, i) => (
                <Reveal key={item.q} delay={i * 60}>
                  <details open={i === 0} className="group overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-colors open:border-accent/30">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left">
                      <span className="text-[0.98rem] font-semibold leading-snug text-ink">
                        {item.q}
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-accent transition-transform duration-300 group-open:rotate-45">
                        <Icon name="Plus" className="h-4 w-4" strokeWidth={2.4} />
                      </span>
                    </summary>
                    <p className="px-6 pb-5 pr-12 text-[0.94rem] leading-relaxed text-muted">
                      {item.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
