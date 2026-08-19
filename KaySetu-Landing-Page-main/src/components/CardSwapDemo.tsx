'use client';

import { useEffect, useState } from 'react';
import Amp from '@/components/Amp';
import {
  Sparkles,
  MapPinned,
  Boxes,
  Rocket,
  Truck,
  TrendingUp,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react';

/* Outcomes by role - NOT customer quotes. We had fabricated testimonials here
   (invented names + stock-photo faces); that's a credibility and ASCI/FTC
   risk. Keep this role-framed until there are real, named customer stories,
   then swap the data for attributed quotes. Same rule as
   `testimonials.note` in lib/content.ts. */
type Outcome = {
  id: number;
  icon: LucideIcon;
  tag: string;
  title: string;
  body: string;
  audience: string;
};

const outcomes: Outcome[] = [
  {
    id: 1,
    icon: MapPinned,
    tag: 'Field Operations',
    title: 'Every field visit, verified by 9 AM',
    body:
      'GPS-, selfie- and photo-verified check-ins settle the fake-visit debate. The entire field day is visible by 9 AM.',
    audience: 'For national field managers',
  },
  {
    id: 2,
    icon: Boxes,
    tag: 'Operations',
    title: 'Stock, production and accounts finally agree',
    body:
      'Inventory, production and accounts reconcile against each other instead of living in three spreadsheets that never agreed. One source of truth, end to end.',
    audience: 'For heads of operations',
  },
  {
    id: 3,
    icon: Rocket,
    tag: 'Rollout',
    title: 'Demos that walk your real scenarios',
    body:
      'The walkthrough runs on your actual workflows, so what your team sees in the demo is exactly what they run from day one.',
    audience: 'For COOs & founders',
  },
  {
    id: 4,
    icon: Truck,
    tag: 'Distribution',
    title: 'Channel stock stops being a guess',
    body:
      'Distributors work in the same system you do, so channel stock and sell-through are visible in real time - no more month-end phone calls.',
    audience: 'For channel & distribution heads',
  },
  {
    id: 5,
    icon: TrendingUp,
    tag: 'Sales',
    title: 'Lead to invoice, without re-typing',
    body:
      'A lead flows straight to the quote, the order and the invoice. Nothing is re-typed between the field and the back office.',
    audience: 'For VPs of sales',
  },
  {
    id: 6,
    icon: ReceiptText,
    tag: 'Finance',
    title: 'GST invoicing that just works',
    body:
      'GST-ready invoicing out of the box. Procurement, accounts and the field team speak to each other - no exports, no reconciliation nights.',
    audience: 'For finance controllers',
  },
];

export function CardSwapDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  /* `active` is in the deps on purpose: picking a chip restarts the
     countdown, so the slide you just chose gets a full turn on screen. */
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % outcomes.length),
      5200
    );
    return () => window.clearInterval(id);
  }, [paused, active]);

  const t = outcomes[active];

  return (
    <section
      id="testimonials"
      className="relative w-full overflow-hidden border-t border-line bg-[#fbfbf9] py-16 md:py-24"
    >
      {/* The 500px orb is clipped by its own layer so it can't add 250px of
          horizontal scroll on phones. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-0 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200/50 blur-[120px]"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-5">
        <div
          className="grid overflow-hidden rounded-[2rem] border border-line bg-card shadow-float lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* ── Navy panel ── */}
          <div className="relative isolate min-w-0 overflow-hidden bg-espresso px-8 py-12 text-center sm:px-12 md:px-16 md:py-20 lg:rounded-r-[2.75rem] lg:text-left">
            {/* dot field, top-left - decorative */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.4px,transparent_1.4px)] [background-size:14px_14px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
            />

            <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-accent-soft ring-1 ring-white/15 lg:mx-0">
              <Sparkles className="h-5 w-5 fill-current" />
            </span>

            <h2 className="relative mt-7 font-display text-[2.2rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[2.6rem] lg:text-[3rem]">
              {/* The br's force one word per visual line; below lg they made
                  "What Changes" the panel's min-content width, blowing the
                  grid item out past the card's clip on small phones. */}
              What Changes <br className="hidden lg:inline" /> From{' '}
              <br className="hidden lg:inline" /> Day One
            </h2>

            <p className="relative mx-auto mt-5 max-w-sm text-[1rem] leading-relaxed text-white/70 lg:mx-0">
              KaySetu bridges the gap between your field force, distributors and back-office operations.
            </p>

            <p className="relative mx-auto mt-6 max-w-sm text-[0.8rem] leading-relaxed text-white/45 lg:mx-0">
              Outcomes by role - we&apos;ll publish named customer stories as we onboard our first teams.
            </p>
          </div>

          {/* ── Outcome ── */}
          <div className="flex min-w-0 flex-col items-center justify-center px-8 py-14 text-center sm:px-12 md:px-16 md:py-20">
            <div key={active} className="animate-fade-up max-w-2xl" style={{ animationDuration: "0.5s" }}>
              <h3 className="mx-auto text-[1.4rem] font-bold leading-snug text-ink sm:text-[1.7rem] lg:text-[1.9rem]">
                {t.title}
              </h3>
              <p className="mx-auto mt-5 text-[1.05rem] leading-relaxed text-muted sm:text-[1.1rem]">
                {t.body}
              </p>
            </div>

            {/* role picker - the active chip grows and takes a teal ring */}
            <div className="mt-10 flex items-center justify-center gap-3 sm:gap-4">
              {outcomes.map((item, i) => {
                const isActive = i === active;
                const ChipIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show the ${item.tag} outcome`}
                    aria-current={isActive}
                    className="shrink-0 rounded-full outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <span
                      className={
                        "flex items-center justify-center rounded-full transition-all duration-300 " +
                        (isActive
                          ? "h-14 w-14 bg-espresso text-accent-soft ring-2 ring-accent ring-offset-2 ring-offset-card sm:h-16 sm:w-16"
                          : "h-9 w-9 bg-slate-100 text-muted opacity-60 hover:opacity-100 sm:h-10 sm:w-10")
                      }
                    >
                      <ChipIcon className={isActive ? "h-6 w-6" : "h-4 w-4"} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div key={`${active}-byline`} className="animate-fade-up mt-6" style={{ animationDuration: "0.5s" }}>
              <div className="font-display text-[1.1rem] font-bold text-ink"><Amp text={t.audience} /></div>
              <div className="mt-1 font-mono text-[0.75rem] uppercase tracking-wider text-faint">
                {t.tag}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
