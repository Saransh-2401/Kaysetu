"use client";

import { useEffect, useState } from 'react';
import CardSwap, { Card } from '@/components/ui/CardSwap';
import { Quote } from 'lucide-react';

/** The swap deck is absolutely positioned and fans out sideways, so it can't be
 *  sized in CSS — the card box and the fan offset both have to shrink together
 *  or the stack hangs off the edge of a phone. */
function useDeckSize() {
  const [size, setSize] = useState({ width: 300, height: 380, distance: 45 });

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      if (w < 400) setSize({ width: 218, height: 380, distance: 22 });
      else if (w < 640) setSize({ width: 250, height: 390, distance: 30 });
      else setSize({ width: 300, height: 420, distance: 45 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return size;
}

const testimonials = [
  {
    id: 1,
    testimonial: "The fake-visit debate is over. GPS-, selfie- and photo-verified check-ins mean the entire field day is visible by 9 AM.",
    author: "Rahul Mehta - National Field Manager",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 2,
    testimonial: "Stock, production and accounts finally reconcile against each other instead of living in three separate spreadsheets that never agreed. One source of truth, end to end.", 
    author: "Anjali Rao - Head of Operations",
    image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 3,
    testimonial: "Honestly the best rollout we've done. The team walked our real scenarios in the demo, and what they showed is exactly what we run today.",
    author: "Kavya Reddy - COO",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 4,
    testimonial: "Our distributors now work in the same system we do. Channel stock and sell-through stopped being a guess overnight.",
    author: "Vikram Shah - Channel & Distribution Head",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 5,
    testimonial: "A lead flows straight to the invoice — nobody re-types anything between the field and the back office. We closed our books three days sooner the very first month.",
    author: "Priya Nair - VP of Sales",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 6,
    testimonial: "GST-ready invoicing that just works. Procurement, accounts and the field team all speak to each other now — no exports, no reconciliation nights.",
    author: "Meera Krishnan - Finance Controller",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&h=128&fit=crop&q=80"
  }
];

export function CardSwapDemo() {
  const deck = useDeckSize();

  return (
    <section
      id="testimonials"
      className="border-t border-line bg-[#fbfbf9] pt-16 pb-32 md:pt-20 md:pb-48 w-full relative overflow-visible"
    >
      {/* Banner background + decorative blur share one clipping layer so the
          500px orb can't add 250px of horizontal scroll on phones. */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img src="/map-bg.png" alt="" className="w-full h-full object-fill opacity-100 mix-blend-normal" />
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-slate-200/50 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 relative z-10">

        <div className="w-full min-w-0 lg:w-5/12 text-left mb-8 lg:mb-0">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-tight md:text-[3.5rem] text-slate-900 mb-5 sm:mb-6 tracking-tight">
            Don&apos;t take our<br/>word for it.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg md:text-xl font-medium max-w-md leading-relaxed mb-6 sm:mb-8">
            KaySetu bridges the gap between your field force, distributors, and back-office operations. See how we transform businesses just like yours:
          </p>
          
          <ul className="space-y-3 sm:space-y-4 text-slate-700 font-medium text-base sm:text-lg">
            <li className="flex items-center gap-3 sm:gap-4">
              <div className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              End-to-end supply chain visibility
            </li>
            <li className="flex items-center gap-3 sm:gap-4">
              <div className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              Real-time verified field tracking
            </li>
            <li className="flex items-center gap-3 sm:gap-4">
              <div className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              Automated reconciliation &amp; invoicing
            </li>
          </ul>
        </div>

        <div className="w-full lg:w-6/12 flex justify-center lg:justify-start">
          <div style={{ height: `${deck.height + 40}px`, width: '100%', maxWidth: '400px', position: 'relative' }} className="flex justify-center mt-10 sm:mt-12 lg:mt-24">
          <CardSwap
            cardDistance={deck.distance}
            verticalDistance={deck.distance}
            delay={3800}
            easing="elastic"
            pauseOnHover={true}
            width={deck.width}
            height={deck.height}
          >
            {/* The card box is a fixed pixel height (the deck is 3D-transformed, so it
                can't grow) — avatar and byline stay at their natural size and only the
                quote gets the leftover space, so the longest testimonial still lands
                inside the card instead of being clipped by overflow-hidden. */}
            {testimonials.map((t, idx) => (
              <Card key={idx} className="flex flex-col items-center justify-between overflow-hidden rounded-2xl bg-[#0f172a] px-5 py-6 sm:px-6 sm:py-7 md:px-7 md:py-8 shadow-2xl border border-white/10">
                <div className="relative mx-auto shrink-0">
                  <img
                    src={t.image}
                    alt={`Avatar of ${t.author}`}
                    className="pointer-events-none h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-full border-4 border-[#0f172a] bg-slate-200 object-cover shadow-lg"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-1.5 sm:p-2 shadow-md">
                    <Quote className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 items-center py-3 sm:py-4">
                  <span className="text-center text-[0.8rem] sm:text-[0.85rem] md:text-[0.95rem] font-medium leading-[1.5] text-slate-200">&quot;{t.testimonial}&quot;</span>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span className="text-center text-sm font-bold text-white">{t.author.split(' - ')[0]}</span>
                  <span className="text-center text-[0.65rem] uppercase tracking-wider text-slate-400 font-mono">{t.author.split(' - ')[1]}</span>
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>
        </div>
      </div>
    </section>
  );
}
