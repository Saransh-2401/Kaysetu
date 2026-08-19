"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { Reveal } from "@/components/Motion";
import Amp from "@/components/Amp";
import BrandMark from "@/components/BrandMark";
import { comparison } from "@/lib/content";

/* The three states content.ts can put in a cell. They used to be drawn as
   check / bare dash / the word "ABSENT", which encoded "limited" and "not at
   all" as two things a reader can't tell apart and can't decode - a dash reads
   as "nothing" just as much as the word does. Each state now has its own
   glyph, its own weight, and a name in the legend under the table. */
const STATES = {
  yes: { label: "Included" },
  partial: { label: "Limited" },
  no: { label: "Not available" },
} as const;

type StateKey = keyof typeof STATES;
const stateOf = (v: string): StateKey => (v in STATES ? (v as StateKey) : "no");

function Mark({
  value,
  highlight,
  inView,
  delay = 0,
}: {
  value: string;
  highlight: boolean;
  inView?: boolean;
  delay?: number;
}) {
  const state = stateOf(value);
  /* Every cell is an icon, so the value has to be spoken for screen readers - 
     before this the whole table was checks and dashes with no text at all. */
  const label = <span className="sr-only">{STATES[state].label}</span>;

  if (state === "yes") {
    return highlight ? (
      <span
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_22px_-8px_rgba(0,150,136,0.8)]"
        style={{
          transition: "transform 0.7s cubic-bezier(0.34,1.4,0.64,1)",
          transitionDelay: `${delay}ms`,
          transform: inView ? "scale(1)" : "scale(0.2)",
        }}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
        {label}
      </span>
    ) : (
      <span className="mx-auto flex items-center justify-center">
        <Check className="h-5 w-5 text-teal-300/85" strokeWidth={2.4} />
        {label}
      </span>
    );
  }

  if (state === "partial") {
    return (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/25 text-white/55">
        <Minus className="h-3 w-3" strokeWidth={3} />
        {label}
      </span>
    );
  }

  return (
    <span className="mx-auto flex items-center justify-center text-white/30">
      <X className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.6} />
      {label}
    </span>
  );
}

/* Same three marks at legend size - the table is unreadable without it. */
function Legend() {
  return (
    /* mt-14, not mt-8: the winner card overhangs the grid by `-inset-y-6`, so
       a smaller gap puts the legend right against its bottom edge. */
    <ul className="mt-14 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[0.78rem] text-white/55">
      <li className="flex items-center gap-2">
        <Check className="h-4 w-4 text-teal-300/85" strokeWidth={2.6} />
        {STATES.yes.label}
      </li>
      <li className="flex items-center gap-2">
        <span className="flex h-[1.15rem] w-[1.15rem] items-center justify-center rounded-full border border-white/25">
          <Minus className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
        {STATES.partial.label}
      </li>
      <li className="flex items-center gap-2">
        <X className="h-4 w-4 text-white/35" strokeWidth={2.6} />
        {STATES.no.label}
      </li>
    </ul>
  );
}

export default function Comparison() {
  const { columns, rows, cost, background } = comparison;
  const hiIndex = columns.findIndex((c) => c.highlight);
  const hiCol = hiIndex + 2; // grid column (1-based): label occupies col 1
  const isHi = (i: number) => i === hiIndex;

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Column-by-column reveal: every cell in a column shares one delay, so the
  // whole column rises + fades in together, one after another (left → right).
  const BASE = 200;
  const STEP_COL = 320; // wider gap between columns → each arrives distinctly
  const colDelay = (col: number) => BASE + col * STEP_COL;
  const cellStyle = (col: number): React.CSSProperties => ({
    transition:
      "opacity 1s cubic-bezier(0.22,1,0.36,1), transform 1s cubic-bezier(0.22,1,0.36,1)",
    transitionDelay: `${colDelay(col)}ms`,
    opacity: inView ? 1 : 0,
    transform: inView ? "none" : "translateY(34px)",
  });

  // borderless row-hover highlight applied to the non-winner cells
  const hoverBg = (r: number, first = false, last = false) =>
    `transition-colors duration-300 ${
      hoverRow === r ? "bg-white/[0.055]" : "bg-transparent"
    } ${first ? "rounded-l-xl" : ""} ${last ? "rounded-r-xl" : ""}`;
  const rowHandlers = (r: number) => ({
    onMouseEnter: () => setHoverRow(r),
    onMouseLeave: () => setHoverRow((v) => (v === r ? null : v)),
  });

  /* On phones the label column gives up some of its minimum so the three
     value columns are wide enough for their header names to wrap instead of
     cropping at the cell edge. */
  const GRID =
    "grid-cols-[minmax(6rem,1.5fr)_repeat(3,minmax(4rem,1.15fr))] sm:grid-cols-[minmax(7rem,1.5fr)_repeat(3,minmax(4rem,1.15fr))]";

  return (
    <section id="why" className="relative overflow-hidden py-20 md:py-24">
      {/* immersive background + legibility overlay */}
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 -z-20 bg-[#06181a]" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#04131a]/85 via-[#04131a]/78 to-[#04131a]/92" />

      <div className="relative mx-auto max-w-[1600px] px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[2rem] font-bold leading-[1.08] tracking-tight text-white balance md:text-[2.9rem]">
            <Amp text={comparison.title} />
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/65">
            {comparison.lead}
          </p>
        </Reveal>

        <div className="mt-12">
          <div ref={gridRef} className={`relative grid w-full ${GRID}`}>
            {/* soft ambient glow behind the whole panel */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-[1] bg-[radial-gradient(60%_60%_at_72%_40%,rgba(0,150,136,0.16),transparent_70%)]"
            />

            {/* winner column - floating cream hero card, reveals with its column */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 -inset-y-6 z-0 grid ${GRID}`}
            >
              <div
                className="relative rounded-[20px] bg-[#f5f2e6]"
                style={{
                  gridColumn: hiCol,
                  transformOrigin: "center 40%",
                  transition:
                    "opacity 1.1s cubic-bezier(0.16,1,0.3,1), transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  transitionDelay: `${colDelay(hiIndex + 1)}ms`,
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0) scale(1)" : "translateY(34px) scale(0.96)",
                  boxShadow:
                    "0 40px 70px -25px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,150,136,0.15)",
                }}
              >
                <span className="absolute -inset-4 -z-10 rounded-[28px] bg-accent/25 blur-2xl" />
              </div>
            </div>

            {/* ── Header row ─────────────────────────────────────── */}
            <div className="relative z-10 flex items-end pb-5 pt-3" style={cellStyle(0)}>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-white/40">
                {comparison.capabilityLabel}
              </span>
            </div>
            {columns.map((c, i) =>
              isHi(i) ? (
                <div
                  key={c.name}
                  style={cellStyle(i + 1)}
                  className="relative z-10 flex min-w-0 flex-col items-center gap-2 px-1 pb-4 pt-5 text-center sm:px-2"
                >
                  <span className="whitespace-nowrap rounded-full bg-accent px-2 py-[3px] text-[0.5rem] font-bold uppercase tracking-[0.1em] text-white shadow-[0_6px_14px_-4px_rgba(0,150,136,0.8)] sm:px-2.5 sm:tracking-[0.16em]">
                    Recommended
                  </span>
                  {/* The mark here was a teal square with a white dot in it,
                      which reads as a broken-image placeholder next to the
                      name. This is the actual brand mark. Mark and name stack
                      on phones - side by side they overflow the column. */}
                  <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
                    <BrandMark className="h-[0.95rem] w-auto text-ink" />
                    <span className="text-[0.72rem] font-bold text-ink sm:text-[0.85rem]">{c.name}</span>
                  </span>
                </div>
              ) : (
                <div
                  key={c.name}
                  style={cellStyle(i + 1)}
                  className="relative z-10 flex min-w-0 items-center justify-center px-1 pb-4 pt-6 text-center sm:px-2"
                >
                  <span className="break-words text-[0.72rem] font-bold leading-tight text-white/80 sm:text-[0.85rem]">
                    {c.name}
                  </span>
                </div>
              )
            )}

            {/* ── Capability rows (borderless, hover-highlighted) ── */}
            {rows.map((row, r) => (
              <div key={row.label} className="contents">
                <div
                  {...rowHandlers(r)}
                  style={cellStyle(0)}
                  className={`relative z-10 flex items-center py-3.5 pl-2 pr-2 text-[0.8rem] leading-snug sm:pl-4 sm:pr-3 sm:text-[0.92rem] ${
                    hoverRow === r ? "text-white" : "text-white/70"
                  } ${hoverBg(r, true)}`}
                >
                  {row.label}
                </div>
                {row.values.map((v, i) => (
                  <div
                    key={i}
                    {...rowHandlers(r)}
                    style={cellStyle(i + 1)}
                    className={`relative z-10 flex items-center justify-center py-3.5 ${
                      isHi(i) ? "" : hoverBg(r, false, i === row.values.length - 1)
                    }`}
                  >
                    <Mark
                      value={v}
                      highlight={isHi(i)}
                      inView={inView}
                      delay={colDelay(i + 1) + (isHi(i) ? r * 85 : 0)}
                    />
                  </div>
                ))}
              </div>
            ))}

            {/* ── Cost row ───────────────────────────────────────── */}
            <div
              style={cellStyle(0)}
              className="relative z-10 mt-2 flex flex-col justify-center py-3.5 pl-2 pr-2 sm:pl-3 sm:pr-3"
            >
              <span className="text-[0.8rem] font-bold leading-snug text-white sm:text-[0.92rem]">
                {cost.label}
              </span>
              <span className="text-[0.68rem] text-white/40 sm:text-[0.72rem]">{cost.note}</span>
            </div>
            {cost.values.map((v, i) => (
              <div
                key={i}
                style={cellStyle(i + 1)}
                className={`relative z-10 mt-2 flex min-w-0 items-center justify-center px-1 py-3.5 text-center text-[0.72rem] font-bold leading-snug sm:px-2 sm:text-[0.82rem] ${
                  isHi(i) ? "text-accent" : "text-white/55"
                }`}
              >
                {v}
              </div>
            ))}
          </div>

          <Legend />
        </div>
      </div>
    </section>
  );
}
