"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import OptionWheel from "@/components/ui/OptionWheel";
import CardSwap, { Card } from "@/components/ui/CardSwap";
import Icon from "@/components/Icon";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "@/components/Motion";
import { modules } from "@/lib/content";

export default function ModuleShowcase() {
  const items = modules.items;
  const n = items.length;
  const kc = Math.floor(n / 2);

  const [activeIdx, setActiveIdx] = useState(0);
  const [wheelProgress, setWheelProgress] = useState(0);
  const active = items[activeIdx];
  const activeIdxRef = useRef(0);

  const shortNames = [
    "Live Tracking",
    "Field Sales",
    "Sales Orders",
    "Distribution",
    "Inventory",
    "Production",
    "Procurement",
    "Finance",
    "Pipeline",
    "Attendance",
    "Travel",
  ];

  const cardThemes = [
    { color: '#0d9488', bg: '#ccfbf1', name: 'live_tracking' }, // 0 Teal
    { color: '#2563eb', bg: '#dbeafe', name: 'field_sales' }, // 1 Blue
    { color: '#ea580c', bg: '#ffedd5', name: 'sales_orders' }, // 2 Orange
    { color: '#9333ea', bg: '#f3e8ff', name: 'distribution' }, // 3 Purple
    { color: '#16a34a', bg: '#dcfce7', name: 'inventory' }, // 4 Green
    { color: '#dc2626', bg: '#fee2e2', name: 'production' }, // 5 Red
    { color: '#0891b2', bg: '#cffafe', name: 'procurement' }, // 6 Cyan
    { color: '#1e40af', bg: '#dbeafe', name: 'finance' }, // 7 Navy
    { color: '#db2777', bg: '#fce7f3', name: 'pipeline' }, // 8 Pink
    { color: '#059669', bg: '#d1fae5', name: 'attendance' }, // 9 Emerald
    { color: '#0284c7', bg: '#e0f2fe', name: 'travel_v2' }, // 10 Sky
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile(); // Check on mount
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleWheelChange = (index: number) => {
    setActiveIdx(index);
    activeIdxRef.current = index;
    setWheelProgress(index);
    
    // If the wheel was dragged/clicked, sync the page scroll position so it doesn't jump back
    if (containerRef.current) {
      const { top } = containerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const containerTop = top + scrollY;
      const windowHeight = window.innerHeight;
      const scrollableDistance = containerRef.current.offsetHeight - windowHeight;
      const targetScroll = containerTop + (index / (n - 1)) * scrollableDistance;

      // Prevent the scroll listener from overwriting the index while we are programmatically scrolling
      isScrollingRef.current = true;
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 500); // 500ms should be enough for smooth scroll to finish
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || isScrollingRef.current) return;
      const { top, height } = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (top <= 0) {
        const scrollProgress = -top;
        const scrollableDistance = height - windowHeight;
        
        if (scrollProgress >= 0 && scrollProgress <= scrollableDistance) {
          const progress = scrollProgress / scrollableDistance;
          
          // Smooth continuous float for the OptionWheel
          const exactIndex = progress * (n - 1);
          setWheelProgress(exactIndex);

          // Integer for the CardSwap snap
          let newIndex = Math.round(exactIndex);
          if (newIndex >= n) newIndex = n - 1;
          if (newIndex < 0) newIndex = 0;
          
          if (newIndex !== activeIdxRef.current) {
            setActiveIdx(newIndex);
            activeIdxRef.current = newIndex;
          }
        } else if (scrollProgress > scrollableDistance) {
          setWheelProgress(n - 1);
          if (activeIdxRef.current !== n - 1) {
            setActiveIdx(n - 1);
            activeIdxRef.current = n - 1;
          }
        }
      } else {
        setWheelProgress(0);
        if (activeIdxRef.current !== 0) {
          setActiveIdx(0);
          activeIdxRef.current = 0;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [n]);

  return (
    <div ref={containerRef} style={{ height: `calc(100vh + ${n * 120}px)` }} className="relative w-full">
      <section
        id="platform"
        className="sticky top-0 w-full h-screen bg-[#f4f7f9] flex flex-col justify-center overflow-hidden px-4 md:px-8"
      >
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] to-transparent opacity-80 pointer-events-none" />

      <Reveal>
        <div className="text-center mb-6 md:mb-12 lg:mb-20">
          <h2 className="font-display text-[1.8rem] leading-tight font-medium tracking-tight text-ink md:text-[3.5rem] mb-2 md:mb-4">
            {modules.title}
          </h2>
          <p className="mx-auto max-w-3xl text-[0.95rem] md:text-[1.3rem] text-faint">
            {modules.lead}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row w-full items-center justify-between gap-4 lg:gap-8 relative z-10">

          {/* LEFT: Option Wheel (Desktop Only) */}
          <div className="hidden lg:block w-full lg:w-2/5 h-[500px] relative shrink-0">
            <OptionWheel
              items={shortNames}
              defaultSelected={0}
              textColor="#64748b"
              activeColor="#009688"
              side="left"
              fontSize={3}
              spacing={2.5}
              curve={2}
              tilt={8.5}
              blur={1.5}
              fade={0.15}
              smoothing={370}
              inset={204}
              loop={false}
              draggable={true}
              controlledIndex={wheelProgress}
              onChange={handleWheelChange}
            />
          </div>

          {/* LEFT: Simple Indicator (Mobile Only) */}
          <div className="flex lg:hidden flex-col items-center justify-center w-full shrink-0 mb-4 h-[70px]">
             <div className="px-4 py-1 rounded-full bg-[#009688]/10 border border-[#009688]/20 text-[#009688] text-[0.75rem] font-bold uppercase tracking-wider mb-2">
                Module {activeIdx + 1} of {n}
             </div>
             <h3 className="font-display text-2xl font-bold text-ink">
                {shortNames[activeIdx]}
             </h3>
          </div>

          {/* RIGHT: Module Details */}
          {/* lg height is 470, not 420: the OptionWheel beside it is already
              h-[500px] and the row is items-center, so anything up to 500px is
              free — and the card needs it or the centred content overflows and
              gets sheared at both ends (badge off the top, footer off the
              bottom). */}
          <div className="w-full lg:w-3/5 max-w-5xl pr-0 lg:pr-12 xl:pr-20 flex flex-col justify-center items-start text-left h-[390px] md:h-[410px] lg:h-[470px] 2xl:h-[490px] shrink-0">
            <div className="w-full h-full relative">
              <CardSwap
                width="100%"
                height="100%"
                cardDistance={8}
                verticalDistance={10}
                skewAmount={2}
                progress={wheelProgress}
              >
                {items.map((mod, i) => {
                  const theme = cardThemes[i];
                  return (
                    <Card
                      key={i}
                      className="w-full h-full bg-white rounded-3xl p-6 md:p-8 xl:p-10 2xl:p-12 shadow-soft border border-line/30 flex flex-col justify-center overflow-hidden relative"
                      style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.1)' }}
                    >
                      {/* Decorative Background Shape */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-[36%] sm:w-[45%] pointer-events-none transition-all duration-700"
                        style={{
                          background: `linear-gradient(135deg, ${theme.bg} 40%, rgba(255,255,255,0) 100%)`,
                          clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
                          borderTopLeftRadius: '30%',
                          borderBottomLeftRadius: '10%'
                        }}
                      />

                      {/* 3D Asset */}
                      <motion.div
                        className="absolute right-0 sm:right-[-10px] md:right-8 bottom-3 md:bottom-8 w-[36%] sm:w-[45%] md:w-[40%] h-[42%] sm:h-[50%] md:h-[70%] pointer-events-none z-0"
                        animate={{ y: [0, -8, 0] }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.15
                        }}
                      >
                        <Image
                          src={`/modules/${theme.name}-v3.png`}
                          alt={mod.name}
                          fill
                          className="object-contain object-right-bottom opacity-95 transition-all duration-700"
                          sizes="(max-width: 768px) 50vw, 30vw"
                        />
                      </motion.div>

                      <div className="flex flex-col gap-3 md:gap-4 xl:gap-5 2xl:gap-6 relative z-10 w-[62%] md:w-[60%]">
                        <span
                          className="flex h-10 w-10 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-[1.2rem] shadow-sm border transition-colors duration-500"
                          style={{
                            backgroundColor: theme.bg,
                            color: theme.color,
                            borderColor: `${theme.color}30`
                          }}
                        >
                          <Icon name={mod.icon} className="h-5 w-5 md:h-8 md:w-8" strokeWidth={1.8} />
                        </span>

                        <h3 className="font-display text-[1.4rem] md:text-[2rem] xl:text-[2.2rem] 2xl:text-[2.5rem] font-bold tracking-tight text-ink leading-tight pr-2">
                          {mod.name}
                        </h3>

                        {/* Clamped at every breakpoint: the card is a fixed
                            height with centred, clipped content, so an extra
                            wrapped line shears the badge off the top rather
                            than growing the box. */}
                        <p className="max-w-md text-[0.95rem] md:text-[1.05rem] 2xl:text-[1.15rem] leading-relaxed text-faint line-clamp-3">
                          {mod.desc}
                        </p>

                        {/* Real <a> into the module page — the crawlable path
                            from the homepage to /platform/<slug>. */}
                        <Link
                          href={`/walkthrough?module=${mod.slug}`}
                          className="group inline-flex w-fit items-center gap-1.5 text-[0.85rem] md:text-[1rem] font-semibold transition-colors"
                          style={{ color: theme.color }}
                        >
                          Explore {mod.name}
                          <Icon
                            name="ArrowRight"
                            className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-300 group-hover:translate-x-1"
                          />
                        </Link>
                      </div>

                      <div className="mt-4 md:mt-6 2xl:mt-8 pt-4 md:pt-5 2xl:pt-6 border-t border-line/40 grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 w-[62%] sm:w-[80%] md:w-[55%] relative z-10">
                        <div className="flex flex-col gap-1 md:gap-2">
                          <span className="whitespace-nowrap text-[0.65rem] md:text-[0.75rem] font-semibold uppercase tracking-wider text-muted">Integration</span>
                          <div className="flex -space-x-2">
                            <span className="h-7 w-7 md:h-9 md:w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm"><Icon name="Boxes" className="w-3 h-3 md:w-4 md:h-4" /></span>
                            <span className="h-7 w-7 md:h-9 md:w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm"><Icon name="Network" className="w-3 h-3 md:w-4 md:h-4" /></span>
                            <span className="h-7 w-7 md:h-9 md:w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm"><Icon name="ShieldCheck" className="w-3 h-3 md:w-4 md:h-4" /></span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 md:gap-2">
                          <span className="whitespace-nowrap text-[0.65rem] md:text-[0.75rem] font-semibold uppercase tracking-wider text-muted">Status</span>
                          <div className="flex items-center gap-1.5 md:gap-2 h-7 md:h-9">
                            <span
                              className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full ring-2 ring-white/50"
                              style={{ backgroundColor: theme.color }}
                            />
                            <span className="whitespace-nowrap text-[0.72rem] sm:text-[0.8rem] md:text-sm font-medium text-ink">Synced & Live</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </CardSwap>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
    </div>
  );
}
