"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { Reveal } from "@/components/Motion";
import { comparison } from "@/lib/content";

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
  if (value === "yes") {
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
      </span>
    ) : (
      <Check className="mx-auto h-5 w-5 text-teal-300/85" strokeWidth={2.4} />
    );
  }
  if (value === "partial") {
    return <Minus className="mx-auto h-5 w-5 text-white/25" strokeWidth={2.6} />;
  }
  return (
    <span className="text-[0.6rem] font-medium uppercase tracking-[0.15em] text-white/25">
      Absent
    </span>
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

  const GRID = "grid-cols-[minmax(7rem,1.5fr)_repeat(3,minmax(4rem,1.15fr))]";

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
            {comparison.title}
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

            {/* winner column — floating cream hero card, reveals with its column */}
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
                  className="relative z-10 flex flex-col items-center gap-2 px-2 pb-4 pt-5 text-center"
                >
                  <span className="rounded-full bg-accent px-2.5 py-[3px] text-[0.5rem] font-bold uppercase tracking-[0.16em] text-white shadow-[0_6px_14px_-4px_rgba(0,150,136,0.8)]">
                    Recommended
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-accent">
                      <span className="h-2 w-2 rounded-[2px] bg-white" />
                    </span>
                    <span className="text-[0.85rem] font-bold text-ink">{c.name}</span>
                  </span>
                </div>
              ) : (
                <div
                  key={c.name}
                  style={cellStyle(i + 1)}
                  className="relative z-10 flex items-center justify-center px-2 pb-4 pt-6 text-center"
                >
                  <span className="text-[0.85rem] font-bold text-white/80">{c.name}</span>
                </div>
              )
            )}

            {/* ── Capability rows (borderless, hover-highlighted) ── */}
            {rows.map((row, r) => (
              <div key={row.label} className="contents">
                <div
                  {...rowHandlers(r)}
                  style={cellStyle(0)}
                  className={`relative z-10 flex items-center py-3.5 pl-4 pr-3 text-[0.92rem] ${
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
              className="relative z-10 mt-2 flex flex-col justify-center py-3.5 pl-3 pr-3"
            >
              <span className="text-[0.92rem] font-bold text-white">{cost.label}</span>
              <span className="text-[0.72rem] text-white/40">{cost.note}</span>
            </div>
            {cost.values.map((v, i) => (
              <div
                key={i}
                style={cellStyle(i + 1)}
                className={`relative z-10 mt-2 flex items-center justify-center px-2 py-3.5 text-center text-[0.82rem] font-bold ${
                  isHi(i) ? "text-accent" : "text-white/55"
                }`}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
