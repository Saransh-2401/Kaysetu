import Link from "next/link";
import { ArrowRight, ShoppingBag, IndianRupee, Users, Calendar, ChevronDown, Flag, Bell, User, Users2 } from "lucide-react";
import { Reveal } from "@/components/Motion";

export default function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-cta-title"
      className="relative isolate overflow-hidden bg-[#f4f7f6] border-t border-line py-14 md:py-18"
    >
      {/* Background watermark tag illustration */}
      <span aria-hidden="true" className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 text-accent/10 opacity-30 hidden lg:block">
        <svg className="h-96 w-96" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.8">
          <path d="M 40 40 L 120 40 L 170 90 L 90 170 L 40 120 Z" strokeDasharray="4 4" />
          <circle cx="70" cy="70" r="10" />
        </svg>
      </span>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,620px)] lg:gap-16 xl:grid-cols-[1fr_minmax(0,680px)] xl:gap-20">
          
          {/* ── Left Column (Copy & CTAs) ───────────────────────────── */}
          <Reveal className="max-w-xl lg:max-w-2xl">
            <span className="font-mono text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-accent block mb-3">
              ONE PLATFORM. EVERY OPERATION.
            </span>
            <h2
              id="closing-cta-title"
              className="font-display text-[2.2rem] sm:text-[2.7rem] lg:text-[3.1rem] font-bold leading-[1.06] tracking-tight text-ink"
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
                href="/packages"
                className="group inline-flex items-center gap-2 rounded-xl border-2 border-accent/60 bg-transparent px-7 py-3.5 text-[0.98rem] font-semibold text-accent-ink hover:bg-accent/8 hover:border-accent transition-all"
              >
                Explore packages
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          {/* ── Right Column (Exact City Street Beat Map Dashboard Mockup) ───────────────────────────── */}
          <Reveal delay={120} className="relative w-full max-w-[560px] justify-self-center lg:max-w-none lg:justify-self-end">
            <div id="closing-cta-card" className="rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xl transition-all duration-300 hover:shadow-2xl">
              
              {/* Dashboard Top Header — two blocks only (logo | title) so it
                  never wraps into an orphaned row; the date picker lives on
                  the map itself like a real dashboard control. */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 border-b border-slate-100 pb-3">
                <div>
                  <div className="font-display text-xl font-bold tracking-tight text-[#10234b]">
                    KaySetu<span className="text-[#009688]">.</span>
                  </div>
                  <div className="font-sans text-[0.68rem] font-medium text-slate-500">
                    Intelligent platform
                  </div>
                </div>

                <div className="min-w-0 text-left sm:text-right">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">
                    <span className="font-sans text-sm sm:text-base font-extrabold tracking-tight text-[#10234b]">
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

              {/* City Street Map Graphic Container */}
              <div className="relative mt-3 h-[180px] sm:h-[200px] lg:h-[230px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-[#eef4f6]">
                {/* Map artwork stretches to fill; pins are HTML overlays at %
                    coordinates so they never distort with the aspect ratio. */}
                <svg viewBox="0 0 600 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none">
                  <defs>
                    <linearGradient id="riverBlue2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#c9e2ec" />
                      <stop offset="100%" stopColor="#b4d6e4" />
                    </linearGradient>
                  </defs>
                  <rect width="600" height="300" fill="#eef4f6" />

                  {/* Parks */}
                  <path d="M -20 45 Q 60 -15 175 28 Q 215 60 160 95 Q 55 112 -20 80 Z" fill="#dcead9" />
                  <path d="M 440 -20 Q 545 5 610 65 L 610 -20 Z" fill="#dcead9" opacity="0.9" />
                  <path d="M 30 310 Q 85 248 175 266 Q 215 285 195 310 Z" fill="#dcead9" opacity="0.9" />

                  {/* River */}
                  <path d="M -10 248 Q 140 218 300 242 T 610 228" stroke="url(#riverBlue2)" strokeWidth="30" strokeLinecap="round" />

                  {/* Secondary street grid */}
                  <path
                    d="M -10 60 L 610 60 M -10 130 L 610 130 M -10 200 L 610 200
                       M 90 -10 L 90 310 M 210 -10 L 210 310 M 330 -10 L 330 310 M 450 -10 L 450 310 M 545 -10 L 545 310"
                    stroke="#dbe5e3"
                    strokeWidth="2"
                  />

                  {/* Primary avenues, gently curved */}
                  <path
                    d="M -10 95 Q 300 70 610 100 M -10 172 Q 300 150 610 178
                       M 150 -10 Q 168 150 132 310 M 385 -10 Q 400 150 372 310"
                    stroke="#ffffff"
                    strokeWidth="6"
                  />

                  {/* Completed beat route (teal, smooth) */}
                  <path
                    d="M 80 210 C 110 168 130 132 170 120 S 252 118 300 140 S 362 108 400 95"
                    stroke="#009688"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Active leg (navy, dashed) */}
                  <path
                    d="M 400 95 C 440 82 468 78 505 80"
                    stroke="#0f2147"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="10 8"
                  />
                </svg>

                {/* Stop pins — circular markers, no stretch distortion */}
                {[
                  { icon: Flag, cls: "bg-[#0f2147]", left: "13.3%", top: "70%" },
                  { icon: Bell, cls: "bg-[#8c5a53]", left: "28.3%", top: "40%" },
                  { icon: Users2, cls: "bg-[#009688]", left: "50%", top: "46.5%" },
                  { icon: User, cls: "bg-[#009688]", left: "66.7%", top: "31.5%" },
                  { icon: Users, cls: "bg-[#0f2147]", left: "84%", top: "26.5%" },
                ].map(({ icon: PinIcon, cls, left, top }, i) => (
                  <span key={i} className="absolute" style={{ left, top }}>
                    <span className={`flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${cls} text-white shadow-md ring-2 ring-white`}>
                      <PinIcon className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                  </span>
                ))}

                {/* Live position on the route */}
                <span className="absolute" style={{ left: "50%", top: "46.5%" }}>
                  <span className="live-dot absolute -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-[#009688]/15" />
                </span>

                {/* Floating period picker — top-left corner stays clear of
                    the route pins and mirrors the legend bottom-right. */}
                <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-600 shadow-md backdrop-blur-md">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span>AUG 2026</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>

                {/* Compact legend */}
                <div className="absolute bottom-2.5 right-2.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-md">
                  {[
                    ["bg-[#0f2147]", "Active Beats"],
                    ["bg-[#009688]", "Completed"],
                    ["bg-slate-400", "Unassigned"],
                  ].map(([dot, label]) => (
                    <div key={label} className="flex items-center gap-2 py-0.5">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      <span className="font-sans text-[0.64rem] font-medium text-[#10234b]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>


              {/* Bottom 3 KPI Metric Cards Row */}
              <div className="mt-3 sm:mt-4 grid gap-2.5 sm:gap-3 sm:grid-cols-3">
                
                {/* Card 1: TOTAL ORDERS */}
                <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#009688] text-white shadow-sm">
                      <ShoppingBag className="h-4.5 w-4.5 sm:h-5 sm:w-5" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.56rem] sm:text-[0.62rem] font-bold tracking-wider text-slate-500 uppercase">
                        TOTAL ORDERS
                      </div>
                      <div className="font-sans text-lg sm:text-xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        2,845
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 whitespace-nowrap text-[0.65rem] sm:text-[0.72rem] font-semibold text-emerald-600">
                    +12.4% <span className="font-medium text-slate-400">vs last wk</span>
                  </div>
                  {/* Vertical Teal Bar Chart */}
                  <div className="mt-2.5 sm:mt-4 flex items-end gap-1 sm:gap-1.5 h-6 sm:h-8 pt-1">
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
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#009688] text-white shadow-sm">
                      <IndianRupee className="h-4.5 w-4.5 sm:h-5 sm:w-5" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.56rem] sm:text-[0.62rem] font-bold tracking-wider text-slate-500 uppercase">
                        GROSS REVENUE
                      </div>
                      <div className="whitespace-nowrap font-sans text-lg sm:text-xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        ₹1.18Cr
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[0.65rem] sm:text-[0.72rem] font-semibold text-emerald-600">
                    +8.7% <span className="font-medium text-slate-400">MoM</span>
                  </div>
                  {/* Sparkline Line Chart with Area Fill */}
                  <div className="mt-2.5 sm:mt-4 h-6 sm:h-8 w-full">
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
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#009688] text-white shadow-sm">
                      <Users className="h-4.5 w-4.5 sm:h-5 sm:w-5" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-mono text-[0.56rem] sm:text-[0.62rem] font-bold tracking-wider text-slate-500 uppercase">
                        ACTIVE REPS
                      </div>
                      <div className="font-sans text-lg sm:text-xl font-extrabold leading-none text-[#10234b] mt-0.5 sm:mt-1">
                        68
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[0.65rem] sm:text-[0.72rem] font-semibold text-slate-400">
                    Out of 72
                  </div>
                  
                  {/* Segmented Progress Bar */}
                  <div className="mt-2.5 sm:mt-3.5 flex h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="w-[65%] bg-[#009688]" />
                    <div className="w-[20%] bg-[#10234b]" />
                    <div className="w-[15%] bg-slate-300" />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-1 text-[0.54rem] sm:text-[0.58rem] font-semibold text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#009688]" /> Online
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#10234b]" /> Route
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
