"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { Reveal } from "@/components/Motion";
import { testimonials } from "@/lib/content";

export default function Testimonials() {
  const items = testimonials.items;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const go = (d: number) => setI((v) => (v + d + items.length) % items.length);
  const t = items[i];

  return (
    <section id="proof" className="border-y border-line bg-espresso">
      <div
        className="mx-auto max-w-[1600px] px-5 py-20 md:py-28"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* LEFT — header + role picker */}
          <Reveal>
            <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight text-card balance md:text-[2.6rem]">
              <Amp text={testimonials.title} />
            </h2>
            <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-card/55">
              {testimonials.note}
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {items.map((it, idx) => (
                <button
                  key={it.role}
                  onClick={() => setI(idx)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.8rem] font-medium transition-colors ${
                    idx === i
                      ? "border-accent/60 bg-accent/10 text-card"
                      : "border-card/12 text-card/55 hover:text-card"
                  }`}
                >
                  <Icon name={it.icon} className="h-3.5 w-3.5" />
                  {it.role}
                </button>
              ))}
            </div>
          </Reveal>

          {/* RIGHT — featured outcome */}
          <Reveal delay={90}>
            <figure className="flex h-full flex-col justify-between rounded-2xl border border-card/12 bg-card/[0.03] p-8 md:p-10">
              <blockquote
                key={i}
                className="reveal is-in font-display text-[1.45rem] font-medium leading-snug text-card balance md:text-[2rem]"
              >
                <Amp text={t.quote} />
              </blockquote>
              <figcaption className="mt-8 flex items-center justify-between border-t border-card/10 pt-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent-soft">
                    <Icon name={t.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-card">{t.role}</div>
                    <div className="text-[0.78rem] text-card/45">Outcome on KaySetu</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Previous"
                    onClick={() => go(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-card/20 text-card transition hover:bg-card/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Next"
                    onClick={() => go(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-card/20 text-card transition hover:bg-card/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
