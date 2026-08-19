"use client";

import { useEffect, useRef, useState } from "react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { AutoMedia, Reveal } from "@/components/Motion";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  LeadsBoard,
  FieldMap,
  QuoteToCash,
  InventoryGrid,
  Dashboard,
  MobileApp,
} from "@/components/AppScreens";
import { walkthrough } from "@/lib/content";

const SCREENS: Record<string, () => React.ReactElement> = {
  leads: LeadsBoard,
  field: FieldMap,
  quote: QuoteToCash,
  inventory: InventoryGrid,
  dashboard: Dashboard,
  mobile: MobileApp,
};

type Step = (typeof walkthrough.steps)[number];

function Media({ step }: { step: Step }) {
  const Screen = SCREENS[step.screen] ?? LeadsBoard;
  return (
    <div className="relative">
      {/* soft teal glow behind the media - inset stays small on phones so the
          decoration never reaches past the viewport edge */}
      <div className="absolute -inset-2 -z-10 rounded-[34px] bg-[radial-gradient(60%_60%_at_60%_30%,rgba(0,150,136,0.07),transparent_70%)] sm:-inset-6" />
      <AutoMedia
        src={step.video || undefined}
        className="overflow-hidden rounded-2xl [&>video]:w-full"
      >
        <Screen />
      </AutoMedia>
    </div>
  );
}

export default function Walkthrough({ 
  data = walkthrough,
  className 
}: { 
  data?: any;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = refs.current.findIndex((r) => r === e.target);
            if (idx !== -1) setActive(idx);
          }
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  const steps = data.steps;
  const progress = (active / (Math.max(1, steps.length - 1))) * 100;

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="walkthrough" className={className || "mx-auto max-w-[1600px] px-5 py-20 md:py-28"}>
      <Reveal className="mx-auto max-w-4xl text-center">
        <h2 className="font-display text-[2.1rem] font-bold leading-[1.03] tracking-tight balance md:text-[3rem]">
          <Amp text={data.title} />
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-muted md:text-[1.15rem]">
          {data.lead}
        </p>
      </Reveal>

      {/* mobile step progress bar */}
      <div className="sticky top-[70px] z-30 -mx-5 mt-8 border-y border-line bg-paper/85 px-5 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between text-[0.62rem] font-medium text-muted">
          <span className="font-mono uppercase tracking-wider text-accent">
            Step {active + 1}/{steps.length}
          </span>
          <span className="text-ink">{steps[active].kicker}</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* No max-w-7xl cap here: the timeline runs the full width of the
          section so the mockups on the right can grow instead of leaving a
          dead right margin. The text column stays fixed, so every extra
          pixel goes to the screen. */}
      <div ref={containerRef} className="mt-20 relative w-full pl-2 md:pl-0">
        {/* Continuous track */}
        <div className="absolute left-[24px] md:left-[30px] top-4 bottom-0 w-[2px] bg-line" />
        {/* Growing accent line */}
        <motion.div 
          className="absolute left-[24px] md:left-[30px] top-4 w-[2px] bg-accent origin-top" 
          style={{ height: lineHeight }} 
        />
        
        <div className="space-y-32 md:space-y-40">
          {steps.map((s: any, i: number) => {
            const isActive = i <= active;
            const isCurrent = i === active;
            return (
              <div
                key={s.n}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`group relative grid gap-8 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] md:gap-10 lg:gap-16 items-start transition-all duration-700 ${isCurrent ? 'opacity-100 translate-y-0' : 'opacity-40 hover:opacity-90'}`}
              >
                {/* Node icon on the timeline */}
                <div className="absolute left-[24px] md:left-[30px] top-1 -translate-x-1/2 z-10">
                  <div className={`flex h-10 w-10 items-center justify-center rounded shadow-sm ring-4 ring-card transition-all duration-700 ${
                    isActive ? "bg-accent text-card scale-110" : "bg-card border-2 border-line text-muted scale-90"
                  }`}>
                    <Icon name={(s as any).icon || "Check"} className={`transition-transform duration-700 ${isCurrent ? "scale-110 h-6 w-6" : "scale-100 h-5 w-5"}`} />
                  </div>
                </div>

                {/* Left Text Block - min-w-0 stops the grid track from being
                    widened past the viewport by its own min-content size. */}
                <div className="min-w-0 pl-[58px] sm:pl-[66px] md:pl-[70px] pt-1">
                  <Reveal>
                    {/* Jakarta at 600, not font-display: the section title above
                        is the serif voice, so a second editorial headline here
                        competes with it. Jakarta's wider counters let the line
                        stay legible at semibold - going heavier just made it
                        shouty. The kicker is tinted and set a notch lighter so
                        the eye lands on it without it out-weighing the line. */}
                    <h3 className="font-heading text-[1.7rem] font-semibold leading-[1.2] tracking-[-0.02em] text-ink md:text-[2rem] lg:text-[2.2rem]">
                      <span className="block mb-1">
                        <span className="font-medium text-accent">{s.kicker}:</span>{" "}
                        <span className="transition-colors duration-500 group-hover:text-accent">{s.title}</span>
                      </span>
                    </h3>
                    <p className="mt-4 text-[1.05rem] leading-relaxed text-muted max-w-sm">{s.body}</p>
                    
                    {(s as any).points && (s as any).points.length > 0 && (
                      <ul className="mt-6 space-y-3">
                        {(s as any).points.map((pt: string, ptIdx: number) => (
                          <li key={ptIdx} className="flex items-start gap-2.5 transition-transform duration-300 hover:translate-x-1">
                            <span className="mt-1 flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-full bg-accent text-card shadow-sm">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span className="text-[0.92rem] text-ink font-medium leading-snug">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Reveal>
                </div>

                {/* Right Image/Video Block */}
                <div className="w-full min-w-0 pr-0 md:pr-0 pl-[40px] sm:pl-[48px] md:pl-0 pt-2 md:pt-0 transition-transform duration-700 ease-out group-hover:-translate-y-2">
                  <Reveal delay={90}>
                    <Media step={s} />
                  </Reveal>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
