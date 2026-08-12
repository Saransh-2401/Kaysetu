import Link from "next/link";
import { ArrowRight, ShoppingBag, IndianRupee, Users, Calendar, ChevronDown, Flag, Bell, User, Users2 } from "lucide-react";
import { Reveal } from "@/components/Motion";

export default function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-cta-title"
      className="relative isolate overflow-hidden bg-[#f4f7f6] border-t border-line py-20 md:py-28"
    >
      {/* Background watermark tag illustration */}
      <span aria-hidden="true" className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 text-accent/10 opacity-30 hidden lg:block">
        <svg className="h-96 w-96" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.8">
          <path d="M 40 40 L 120 40 L 170 90 L 90 170 L 40 120 Z" strokeDasharray="4 4" />
          <circle cx="70" cy="70" r="10" />
        </svg>
      </span>

      <div className="mx-auto max-w-[1600px] px-5">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          
          {/* ── Left Column (Copy & CTAs) ───────────────────────────── */}
          <Reveal className="max-w-xl">
            <span className="font-mono text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-accent block mb-3">
              ONE PLATFORM. EVERY OPERATION.
            </span>
            <h2
              id="closing-cta-title"
              className="font-display text-[2.6rem] sm:text-[3.2rem] lg:text-[3.8rem] font-bold leading-[1.06] tracking-tight text-ink"
            >
              KaySetu does the<br />
              busy work for you<span className="text-accent">.</span>
            </h2>

            <p className="mt-5 text-[1.08rem] leading-relaxed text-muted sm:text-[1.12rem]">
              Sales, distribution, inventory, finance and workforce—unified on one intelligent platform.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="btn-primary group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[0.98rem] font-semibold shadow-float"
              >
                Book a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/walkthrough"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-accent/60 bg-transparent px-7 py-3.5 text-[0.98rem] font-semibold text-accent-ink hover:bg-accent/8 hover:border-accent transition-all"
              >
                See how it works
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          {/* ── Right Column (Exact City Street Beat Map Dashboard Mockup) ───────────────────────────── */}
          <Reveal delay={120} className="relative w-full max-w-[600px] justify-self-center lg:justify-self-end">
            <div id="closing-cta-card" className="rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-5 shadow-xl transition-all duration-300 hover:shadow-2xl">
              
              {/* Dashboard Top Header */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="font-display text-xl font-bold tracking-tight text-[#10234b]">
                      KaySetu<span className="text-[#009688]">.</span>
                    </div>
                    <div className="font-sans text-[0.68rem] font-medium text-slate-500">
                      Intelligent platform
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-base sm:text-lg font-extrabold tracking-tight text-[#10234b]">
                        FIELD SALES BEAT MAP
                      </span>
                      <span className="rounded-full border border-[#009688]/40 bg-[#009688]/8 px-2.5 py-0.5 font-sans text-[0.7rem] font-semibold text-[#009688]">
                        Sales Management
                      </span>
                    </div>
                    <div className="font-sans text-[0.68rem] font-semibold text-slate-400 mt-0.5">
                      LIVE BEAT ROUTE | <span className="text-[#009688]">AUG 2026</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-[0.72rem] font-semibold text-slate-600 shadow-sm">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span>AUG 2026</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              {/* City Street Map Graphic Container */}
              <div className="relative mt-3.5 h-[230px] sm:h-[250px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-[#edf4f5]">
                
                {/* SVG City Street Map Graphic */}
                <svg
                  viewBox="0 0 600 300"
                  className="absolute inset-0 h-full w-full"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="riverBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#c5e0ea" />
                      <stop offset="100%" stopColor="#b0d4e3" />
                    </linearGradient>
                  </defs>

                  {/* Base Map Tile Background */}
                  <rect width="600" height="300" fill="#edf4f5" />

                  {/* Green Parks & Open Spaces */}
                  {/* Top Left Park */}
                  <path d="M -10 100 Q 40 40, 140 20 Q 200 40, 240 10 L 250 -10 L -10 -10 Z" fill="#d5e6d8" opacity="0.85" />
                  {/* Mid Left Park */}
                  <path d="M 20 180 Q 90 170, 130 200 Q 150 250, 110 290 Q 30 300, 0 260 Z" fill="#d5e6d8" opacity="0.85" />
                  {/* Center Top Park */}
                  <path d="M 260 20 Q 300 0, 370 10 Q 380 50, 330 60 Q 270 50, 260 20 Z" fill="#d5e6d8" opacity="0.8" />
                  {/* Right Riverbank Park */}
                  <path d="M 460 280 Q 520 220, 580 230 L 610 310 L 440 310 Z" fill="#d5e6d8" opacity="0.75" />

                  {/* Winding River Waterway (Bottom curved River Thames style) */}
                  <path
                    d="M -10 200 Q 120 170, 260 200 T 450 170 T 610 210"
                    stroke="url(#riverBlue)"
                    strokeWidth="38"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M -10 200 Q 120 170, 260 200 T 450 170 T 610 210"
                    stroke="#a5cadb"
                    strokeWidth="2"
                    fill="none"
                  />

                  {/* Major Avenue & Street Grid (White Primary Roads) */}
                  <path
                    d="M -10 90 L 610 90
                       M -10 145 L 610 145
                       M -10 230 L 610 230
                       M 110 -10 L 110 310
                       M 240 -10 L 240 310
                       M 370 -10 L 370 310
                       M 500 -10 L 500 310"
                    stroke="#ffffff"
                    strokeWidth="5"
                  />

                  {/* Diagonal & Curved Primary Arterials */}
                  <path d="M 20 -10 L 320 310 M 230 -10 L 560 310 M -10 40 L 400 310" stroke="#ffffff" strokeWidth="6" />

                  {/* Secondary Streets (Light Gray Inner Road Network) */}
                  <path
                    d="M -10 30 L 610 30
                       M -10 60 L 610 60
                       M -10 120 L 610 120
                       M -10 175 L 610 175
                       M -10 260 L 610 260
                       M 50 -10 L 50 310
                       M 170 -10 L 170 310
                       M 300 -10 L 300 310
                       M 430 -10 L 430 310
                       M 550 -10 L 550 310"
                    stroke="#d2dfd9"
                    strokeWidth="2"
                  />

                  {/* Architectural Landmark Building Icons */}
                  {/* Building 1: Skyscraper (Top Center) */}
                  <g transform="translate(255, 25)" fill="#2b3b5c" opacity="0.75">
                    <rect x="0" y="0" width="14" height="24" rx="1" />
                    <rect x="3" y="-5" width="8" height="5" />
                    <line x1="7" y1="-5" x2="7" y2="-10" stroke="#2b3b5c" strokeWidth="1.5" />
                    <rect x="3" y="4" width="3" height="3" fill="#ffffff" opacity="0.7" />
                    <rect x="8" y="4" width="3" height="3" fill="#ffffff" opacity="0.7" />
                    <rect x="3" y="10" width="3" height="3" fill="#ffffff" opacity="0.7" />
                    <rect x="8" y="10" width="3" height="3" fill="#ffffff" opacity="0.7" />
                  </g>

                  {/* Building 2: Arch / Station (Center Left) */}
                  <g transform="translate(250, 140)" fill="#2b3b5c" opacity="0.75">
                    <path d="M 0 16 V 4 Q 10 -2, 20 4 V 16 Z" />
                    <path d="M 6 16 V 9 Q 10 6, 14 9 V 16 Z" fill="#edf4f5" />
                  </g>

                  {/* Building 3: Heritage Dome (Bottom Center) */}
                  <g transform="translate(290, 225)" fill="#2b3b5c" opacity="0.75">
                    <path d="M 0 14 V 6 A 8 8 0 0 1 16 6 V 14 Z" />
                    <rect x="-2" y="14" width="20" height="3" />
                  </g>

                  {/* Building 4: Tower (Bottom Right) */}
                  <g transform="translate(425, 200)" fill="#2b3b5c" opacity="0.75">
                    <rect x="2" y="0" width="10" height="22" />
                    <polygon points="7,-6 2,0 12,0" />
                  </g>

                  {/* ── Beat Route Lines ───────────────────────────── */}
                  
                  {/* Navy Beat Route Path */}
                  <path
                    d="M 170 75 L 195 120 L 230 120 L 230 145 L 260 145 L 260 175 L 200 175 L 200 230"
                    stroke="#0f2147"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M 440 145 L 440 75 L 475 75"
                    stroke="#0f2147"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Teal Beat Route Path */}
                  <path
                    d="M 170 75 L 170 145 L 260 145 L 285 100 L 375 75 L 390 145 L 440 145"
                    stroke="#009688"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M 260 175 L 285 175 L 285 230 M 285 175 L 440 145"
                    stroke="#009688"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Orange Secondary Connector Road */}
                  <path
                    d="M 260 145 L 285 145"
                    stroke="#e07a5f"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />

                  {/* ── Teardrop Map Location Pins & Icons ───────────────────────────── */}

                  {/* Pin 1: Navy Flag Pin (Top Left) */}
                  <g transform="translate(170, 75)" className="drop-shadow-md">
                    <path d="M 0 0 C -11 0 -18 -7 -18 -16 C -18 -26 0 -40 0 -40 C 0 -40 18 -26 18 -16 C 18 -7 11 0 0 0 Z" fill="#0f2147" />
                    <circle cx="0" cy="-16" r="9" fill="#0f2147" />
                    <Flag className="h-4 w-4 text-white" style={{ transform: "translate(-8px, -24px)" }} strokeWidth={2.5} />
                  </g>

                  {/* Pin 2: Brown Bell Pin (Mid-Left) */}
                  <g transform="translate(110, 125)" className="drop-shadow-md">
                    <path d="M 0 0 C -11 0 -18 -7 -18 -16 C -18 -26 0 -40 0 -40 C 0 -40 18 -26 18 -16 C 18 -7 11 0 0 0 Z" fill="#8c5a53" />
                    <circle cx="0" cy="-16" r="9" fill="#8c5a53" />
                    <Bell className="h-4 w-4 text-white" style={{ transform: "translate(-8px, -24px)" }} strokeWidth={2.5} />
                  </g>

                  {/* Pin 3: Teal Group Pin (Center) */}
                  <g transform="translate(275, 100)" className="drop-shadow-md">
                    <path d="M 0 0 C -11 0 -18 -7 -18 -16 C -18 -26 0 -40 0 -40 C 0 -40 18 -26 18 -16 C 18 -7 11 0 0 0 Z" fill="#009688" />
                    <circle cx="0" cy="-16" r="9" fill="#009688" />
                    <Users2 className="h-4 w-4 text-white" style={{ transform: "translate(-8px, -24px)" }} strokeWidth={2.5} />
                  </g>

                  {/* Pin 4: Teal User Pin (Top Right) */}
                  <g transform="translate(375, 75)" className="drop-shadow-md">
                    <path d="M 0 0 C -11 0 -18 -7 -18 -16 C -18 -26 0 -40 0 -40 C 0 -40 18 -26 18 -16 C 18 -7 11 0 0 0 Z" fill="#009688" />
                    <circle cx="0" cy="-16" r="9" fill="#009688" />
                    <User className="h-4 w-4 text-white" style={{ transform: "translate(-8px, -24px)" }} strokeWidth={2.5} />
                  </g>

                  {/* Pin 5: Navy Team Pin (Right) */}
                  <g transform="translate(475, 75)" className="drop-shadow-md">
                    <path d="M 0 0 C -11 0 -18 -7 -18 -16 C -18 -26 0 -40 0 -40 C 0 -40 18 -26 18 -16 C 18 -7 11 0 0 0 Z" fill="#0f2147" />
                    <circle cx="0" cy="-16" r="9" fill="#0f2147" />
                    <Users className="h-4 w-4 text-white" style={{ transform: "translate(-8px, -24px)" }} strokeWidth={2.5} />
                  </g>

                </svg>

                {/* Floating Map Legend Overlay (Bottom Right) */}
                <div className="absolute right-4 bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-3 px-4 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-[#0f2147]" />
                    <span className="font-sans font-medium text-[#10234b]">Active Beats</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-[#009688]" />
                    <span className="font-sans font-medium text-[#10234b]">Completed</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-slate-400" />
                    <span className="font-sans font-medium text-[#10234b]">Unassigned</span>
                  </div>
                </div>
              </div>

              {/* Bottom 3 KPI Metric Cards Row */}
              <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-4 sm:grid-cols-3">
                
                {/* Card 1: TOTAL ORDERS */}
                <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#009688] text-white shadow-sm">
                      <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.62rem] sm:text-[0.68rem] font-bold tracking-wider text-slate-500 uppercase">
                        TOTAL ORDERS
                      </div>
                      <div className="font-sans text-xl sm:text-2xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        2,845
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[0.7rem] sm:text-xs font-semibold text-emerald-600">
                    +12.4% <span className="font-medium text-slate-400">vs last week</span>
                  </div>
                  {/* Vertical Teal Bar Chart */}
                  <div className="mt-2.5 sm:mt-4 flex items-end gap-1 sm:gap-1.5 h-7 sm:h-10 pt-1">
                    {[35, 55, 40, 75, 50, 95, 65, 100, 80, 100].map((h, i) => (
                      <div
                        key={i}
                        className="w-full rounded-t bg-[#009688] transition-all duration-300 hover:bg-[#00796b]"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Card 2: GROSS REVENUE */}
                <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#009688] text-white shadow-sm">
                      <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.62rem] sm:text-[0.68rem] font-bold tracking-wider text-slate-500 uppercase">
                        GROSS REVENUE
                      </div>
                      <div className="font-sans text-xl sm:text-2xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        ₹1.18 CR
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[0.7rem] sm:text-xs font-semibold text-emerald-600">
                    +8.7% <span className="font-medium text-slate-400">MoM</span>
                  </div>
                  {/* Sparkline Line Chart with Area Fill */}
                  <div className="mt-2.5 sm:mt-4 h-7 sm:h-10 w-full">
                    <svg viewBox="0 0 120 35" className="h-full w-full overflow-visible" fill="none">
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#009688" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#009688" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 30 L 15 25 L 30 27 L 45 20 L 60 22 L 75 16 L 90 18 L 105 8 L 120 3"
                        stroke="#009688"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 0 30 L 15 25 L 30 27 L 45 20 L 60 22 L 75 16 L 90 18 L 105 8 L 120 3 L 120 35 L 0 35 Z"
                        fill="url(#revGrad)"
                      />
                      <circle cx="120" cy="3" r="3.5" fill="#009688" />
                    </svg>
                  </div>
                </div>

                {/* Card 3: ACTIVE REPS */}
                <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#009688] text-white shadow-sm">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.62rem] sm:text-[0.68rem] font-bold tracking-wider text-slate-500 uppercase">
                        ACTIVE REPS
                      </div>
                      <div className="font-sans text-xl sm:text-2xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        68
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[0.7rem] sm:text-xs font-semibold text-slate-400">
                    Out of 72
                  </div>
                  
                  {/* Segmented Progress Bar */}
                  <div className="mt-2.5 sm:mt-3.5 flex h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="w-[65%] bg-[#009688]" />
                    <div className="w-[20%] bg-[#10234b]" />
                    <div className="w-[15%] bg-slate-300" />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[0.62rem] sm:text-[0.68rem] font-semibold text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#009688]" /> Online
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#10234b]" /> On Route
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-slate-400" /> Pending
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
