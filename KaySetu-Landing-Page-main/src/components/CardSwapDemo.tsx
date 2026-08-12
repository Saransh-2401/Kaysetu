"use client";

import { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    title: "Every field visit, verified by 9 AM",
    testimonial: "The fake-visit debate is over. GPS-, selfie- and photo-verified check-ins mean the entire field day is visible by 9 AM.",
    name: "Rahul Mehta",
    role: "National Field Manager",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 2,
    title: "Stock, production and accounts finally agree",
    testimonial: "Stock, production and accounts finally reconcile against each other instead of living in three separate spreadsheets that never agreed. One source of truth, end to end.",
    name: "Anjali Rao",
    role: "Head of Operations",
    image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 3,
    title: "The best rollout we've done",
    testimonial: "Honestly the best rollout we've done. The team walked our real scenarios in the demo, and what they showed is exactly what we run today.",
    name: "Kavya Reddy",
    role: "COO",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 4,
    title: "Channel stock stopped being a guess",
    testimonial: "Our distributors now work in the same system we do. Channel stock and sell-through stopped being a guess overnight.",
    name: "Vikram Shah",
    role: "Channel & Distribution Head",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 5,
    title: "Lead to invoice, without re-typing",
    testimonial: "A lead flows straight to the invoice. Nobody re-types anything between the field and the back office. We closed our books three days sooner the very first month.",
    name: "Priya Nair",
    role: "VP of Sales",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 6,
    title: "GST invoicing that just works",
    testimonial: "GST-ready invoicing that just works. Procurement, accounts and the field team all speak to each other now: no exports, no reconciliation nights.",
    name: "Meera Krishnan",
    role: "Finance Controller",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&h=128&fit=crop&q=80"
  }
];

export function CardSwapDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  /* `active` is in the deps on purpose: picking an avatar restarts the
     countdown, so the slide you just chose gets a full turn on screen. */
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % testimonials.length),
      5200
    );
    return () => window.clearInterval(id);
  }, [paused, active]);

  const t = testimonials[active];

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
          <div className="relative isolate overflow-hidden bg-espresso px-8 py-12 sm:px-12 md:px-16 md:py-20 lg:rounded-r-[2.75rem]">
            {/* dot field, top-left — decorative */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.9)_1.4px,transparent_1.4px)] [background-size:14px_14px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
            />

            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-accent-soft ring-1 ring-white/15">
              <Quote className="h-5 w-5 fill-current" />
            </span>

            <h2 className="relative mt-7 font-display text-[2.2rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[2.6rem] lg:text-[3rem]">
              What Our<br />Customers<br />Are Saying
            </h2>

            <p className="relative mt-5 max-w-sm text-[1rem] leading-relaxed text-white/70">
              KaySetu bridges the gap between your field force, distributors and back-office operations.
            </p>
          </div>

          {/* ── Testimonial ── */}
          <div className="flex flex-col items-center justify-center px-8 py-14 text-center sm:px-12 md:px-16 md:py-20">
            <div key={active} className="animate-fade-up max-w-2xl" style={{ animationDuration: "0.5s" }}>
              <h3 className="mx-auto text-[1.4rem] font-bold leading-snug text-ink sm:text-[1.7rem] lg:text-[1.9rem]">
                {t.title}
              </h3>
              <p className="mx-auto mt-5 text-[1.05rem] leading-relaxed text-muted sm:text-[1.1rem]">
                "{t.testimonial}"
              </p>
            </div>

            {/* avatar picker — the active face grows and takes a teal ring */}
            <div className="mt-10 flex items-center justify-center gap-3 sm:gap-4">
              {testimonials.map((item, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Read the testimonial from ${item.name}`}
                    aria-current={isActive}
                    className="shrink-0 rounded-full outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <img
                      src={item.image}
                      alt=""
                      className={
                        "rounded-full bg-paper object-cover transition-all duration-300 " +
                        (isActive
                          ? "h-14 w-14 ring-2 ring-accent ring-offset-2 ring-offset-card sm:h-16 sm:w-16"
                          : "h-9 w-9 opacity-45 grayscale hover:opacity-80 hover:grayscale-0 sm:h-10 sm:w-10")
                      }
                    />
                  </button>
                );
              })}
            </div>

            <div key={`${active}-byline`} className="animate-fade-up mt-6" style={{ animationDuration: "0.5s" }}>
              <div className="font-display text-[1.1rem] font-bold text-ink">{t.name}</div>
              <div className="mt-1 font-mono text-[0.75rem] uppercase tracking-wider text-faint">
                {t.role}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
