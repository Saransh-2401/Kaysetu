'use client';
import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronRight, Command, Activity, Box, Users, Search, Bell, Settings, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RotatingWords } from '@/components/ui/rotating-words'

// The rolling half of the headline. Lower-case on purpose - it renders in the
// display serif italic, where caps read as shouting rather than editorial.
// Each entry is the WHOLE second line ("from …"): RotatingWords reserves the
// longest phrase's width and centres the current one inside it, so rotating
// full lines keeps every phrase optically centred - a static "from" prefix
// next to the reserved box left a hole beside short phrases.
// 'from one place' leads so the settled line is the brand statement before
// the roll starts telling the flow stories.
const HERO_ROLL_WORDS = [
    'from one place',
    'from field to finance',
    'from order to cash',
    'from factory to ledger',
    'from lead to loyalty',
];

// Industries strip under the CTAs - same list the showcase hero trusts.
const HERO_TRUST = [
    'FMCG',
    'Distribution',
    'Pharma',
    'Building materials',
    'Manufacturing',
    'Agri-inputs',
    'Textiles',
    'Cosmetics',
];

export function HeroSection() {
    // Scroll-driven stage tilt: the dashboard leans back 14° on load and
    // straightens as the visitor scrolls through the hero, which turns the
    // below-the-fold sliver into an invitation rather than a crop. Only
    // transform animates, and reduced-motion visitors get a flat device.
    const sectionRef = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end 45%'],
    });
    const tiltRotate = useTransform(scrollYProgress, [0, 0.45], [14, 0]);
    const tiltScale = useTransform(scrollYProgress, [0, 0.45], [0.965, 1]);

    // Full-viewport hero: on desktop the section targets the space left under
    // the announce bar + nav (~6.75rem) and the device mockup flex-fits the
    // room below the copy, so the WHOLE dashboard frame is visible on one
    // screen. Inside the mockup only the decorative image zones shrink - 
    // titles, prices and buttons never crop. On cramped laptops the section
    // grows past the fold instead of hiding the frame; the min() cap stops
    // ultra-tall monitors from stretching the band.
    return (
        <section
            id="top"
            ref={sectionRef}
            className="relative isolate overflow-hidden lg:flex lg:h-[clamp(57rem,calc(100svh-6.75rem),68rem)] lg:flex-col"
        >
            {/* ── Backdrop: stacked paper panels ───────────────────────────
                Order matters: wash → artwork → white spotlight → bottom fade
                that hands off to the page. The artwork keeps its own aspect
                and is pinned to the top edge, so the composition never gets
                cropped sideways on narrow screens; the wash carries whatever
                height is left below it. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
                <div className="hero-wash absolute inset-0" />

                {/* Plain <img>, not next/image: the artwork is flat gradients that
                    compress to ~8KB as webp, so the optimizer would only add a
                    slow AVIF encode in front of it. Below ~640px its own aspect
                    would shrink it to a thin band at the top, so it keeps a
                    height floor there and crops the sides instead. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/hero-custom-bg-1.webp"
                    alt=""
                    width={1926}
                    height={816}
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-x-0 top-0 w-full min-h-[24rem] object-cover object-top sm:min-h-0 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_25%,rgba(0,0,0,0)_50%)]"
                />

                {/* Extended paper panel wash extending till the bottom of the card background */}
                <div className="absolute inset-x-4 top-16 bottom-6 mx-auto max-w-[1440px] rounded-[2.5rem] bg-gradient-to-b from-white/70 via-white/50 to-transparent" />

                {/* drifting glow blobs - slow, compositor-only atmosphere */}
                <div className="hero-blob absolute -left-40 top-16 h-[24rem] w-[24rem] rounded-full bg-accent/12 blur-3xl" />
                <div className="hero-blob-slow absolute -right-32 top-56 h-[28rem] w-[28rem] rounded-full bg-[#10234b]/8 blur-3xl" />

                <div className="hero-spot absolute inset-0" />

                {/* film grain - keeps the big flat washes from banding */}
                <div
                    className="absolute inset-0 opacity-[0.05] mix-blend-multiply"
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>\")",
                    }}
                />

                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paper/15 to-paper" />
            </div>

            <div className="mx-auto w-full max-w-[1600px] px-4 pt-10 sm:px-6 sm:pt-14 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pb-6 lg:pt-6">
                {/* ── Copy block, centred ─────────────────────────────── */}
                <div className="mx-auto max-w-4xl text-center">
                    {/* Fluid size, not breakpoint steps: the rolling line is a single
                        unbreakable token, so it has to fit at every width in between. */}
                    <h1 className="animate-fade-up font-display text-[clamp(2.1rem,5.4vw,3.6rem)] font-bold leading-[1.08] tracking-tight text-ink">
                        Run Your Entire Business
                        {/* Own fluid clamp, not a flat 1.02em: at phone widths the
                            longest phrase ("from factory to ledger") is wider than
                            the screen and the letter spans wrap mid-word. */}
                        <span className="mt-1 block whitespace-nowrap font-display text-[clamp(1.3rem,7.2vw,1.02em)] font-medium italic leading-[1.15] text-accent sm:mt-2">
                            <RotatingWords words={HERO_ROLL_WORDS} interval={3400} />
                        </span>
                    </h1>

                    <p className="animate-fade-up delay-1 mx-auto mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-muted sm:mt-5 sm:text-[1.05rem]">
                        KaySetu brings your sales, orders, distribution, inventory, workforce, and finances together - helping you stay in control and grow with confidence.
                    </p>

                    <div className="animate-fade-up delay-2 mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:mt-7 sm:gap-3">
                        <Link
                            href="/packages"
                            className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.92rem] font-semibold sm:px-7 sm:text-[0.96rem]"
                        >
                            Explore packages
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="/contact"
                            className="group inline-flex items-center gap-2.5 rounded-full border border-ink/15 bg-white/80 px-6 py-3 text-[0.92rem] font-semibold text-ink backdrop-blur-sm transition-colors hover:border-accent/40 hover:bg-white sm:px-7 sm:text-[0.96rem]"
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/12 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                                <Play className="ml-px h-2.5 w-2.5 fill-current" />
                            </span>
                            Get a demo
                        </Link>
                    </div>

                    {/* Industries marquee - quiet social proof, in motion */}
                    <div className="animate-fade-up delay-3 mx-auto mt-8 max-w-xl sm:mt-9">
                        <p className="text-center text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-faint">
                            Built for fast-moving businesses across
                        </p>
                        <div className="group relative mt-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]">
                            <div
                                className="marquee-track items-center"
                                style={{ '--marquee-duration': '30s' } as React.CSSProperties}
                            >
                                {[...HERO_TRUST, ...HERO_TRUST].map((t, i) => (
                                    <span
                                        key={`${t}-${i}`}
                                        className="flex items-center whitespace-nowrap font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted/80"
                                    >
                                        <span className="px-4">{t}</span>
                                        <span className="h-1 w-1 rounded-full bg-accent/40" />
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── The product, straight on, running off the bottom edge ── */}
                <div className="relative mx-auto mt-12 w-full max-w-5xl [perspective:1600px] sm:mt-14 lg:mt-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                    {/* soft glow pooling under the device */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-8 bottom-0 top-12 -z-10 rounded-[3rem] bg-accent/12 blur-3xl"
                    />

                    {/* Stage: device + its two live panels tilt as one object */}
                    <motion.div
                        style={{
                            rotateX: reduced ? 0 : tiltRotate,
                            scale: reduced ? 1 : tiltScale,
                            transformOrigin: 'center top',
                        }}
                        className="relative will-change-transform lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                    >

                    {/* bezel - closed on all four sides now that the whole frame
                        lives inside the hero instead of running off the fold */}
                    <div className="rounded-[1.25rem] border border-white/10 bg-ink p-1.5 shadow-[0_-8px_50px_-24px_rgba(16,35,75,0.5),0_44px_90px_-34px_rgba(16,35,75,0.55)] sm:rounded-[1.85rem] sm:p-2.5 lg:flex lg:min-h-0 lg:max-h-[39.5rem] lg:flex-1 lg:flex-col">
                        <div className="h-[23rem] overflow-hidden rounded-[0.85rem] bg-white xs:h-[26rem] sm:h-[32rem] sm:rounded-[1.3rem] md:h-[36rem] lg:h-auto lg:min-h-0 lg:flex-1">
                            {/* Inner Dashboard UI Mockup */}
                            <div className="relative flex h-full w-full overflow-hidden bg-white text-left">

                                {/* Sidebar */}
                                <div className="w-14 shrink-0 md:w-20 border-r border-line/20 bg-white hidden sm:flex flex-col items-center py-4 md:py-6 gap-4 md:gap-6 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                                    <div className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-lg mb-4">K</div>
                                    <div className="p-2 rounded-xl bg-accent/15 text-accent"><Command className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Box className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Activity className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Users className="w-5 h-5" /></div>
                                    {/* Initials avatars, not external photo services: no third-party
                                        request from the hero, and no random strangers' faces. */}
                                    <div className="mt-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-accent/15 text-[0.65rem] font-semibold text-accent">
                                        AS
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
                                    {/* Header */}
                                    <div className="h-11 sm:h-14 md:h-16 lg:h-14 border-b border-line/40 flex items-center px-3 sm:px-6 justify-between gap-3">
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4 text-[0.8rem] sm:text-sm text-muted-foreground sm:w-1/2 sm:flex-none">
                                            <Search className="w-4 h-4 shrink-0" />
                                            <input type="text" placeholder="Search products or SKUs..." className="bg-transparent border-none outline-none w-full min-w-0 text-[0.8rem] sm:text-sm" disabled />
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                                            <Bell className="w-4 h-4 text-muted-foreground" />
                                            <Settings className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>

                                    {/* Subheader */}
                                    <div className="px-3 sm:px-6 pt-3 pb-2.5 sm:pt-6 sm:pb-4 lg:pt-4 lg:pb-3 flex justify-between items-end gap-4 border-b border-line/10">
                                        <div className="flex min-w-0 gap-6 md:gap-12">
                                            <div className="min-w-0">
                                                <p className="text-[0.65rem] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Department</p>
                                                <h2 className="text-base sm:text-xl md:text-2xl lg:text-xl font-semibold flex items-center gap-1.5 sm:gap-2">Distribution <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground rotate-90" /></h2>
                                            </div>
                                            <div className="hidden md:block">
                                                <p className="text-xs text-muted-foreground mb-1">Location</p>
                                                <h2 className="text-xl md:text-2xl lg:text-xl font-semibold flex items-center gap-2">Jaipur, RJ <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground rotate-90" /></h2>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex flex-col items-end shrink-0">
                                            <p className="text-xs text-muted-foreground mb-2">Shared with</p>
                                            <div className="flex -space-x-2">
                                                <span className="flex w-6 h-6 items-center justify-center rounded-full border-2 border-background bg-sky-100 text-[0.55rem] font-semibold text-sky-700">RK</span>
                                                <span className="flex w-6 h-6 items-center justify-center rounded-full border-2 border-background bg-amber-100 text-[0.55rem] font-semibold text-amber-700">PV</span>
                                                <span className="flex w-6 h-6 items-center justify-center rounded-full border-2 border-background bg-emerald-100 text-[0.55rem] font-semibold text-emerald-700">NM</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid */}
                                    <div className="flex-1 min-h-0 lg:min-h-[19.25rem] p-3 sm:p-5 md:p-8 lg:p-4 overflow-hidden">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 h-full">
                                            {/* Card 1 */}
                                            <div className="border border-line/10 rounded-2xl p-3 sm:p-4 md:p-5 lg:p-4 flex flex-col min-w-0 bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all">
                                                <div className="h-20 sm:h-32 md:h-40 lg:h-auto lg:min-h-12 lg:flex-1 bg-transparent rounded-lg mb-3 sm:mb-5 md:mb-6 lg:mb-4 flex items-center justify-center">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-14 lg:h-14 rounded-full border-4 border-red-400/20 grid grid-cols-2 gap-1"><div className="rounded-full border-4 border-red-500"/><div className="rounded-full border-4 border-red-500"/><div className="rounded-full border-4 border-red-500"/></div>
                                                </div>
                                                <h3 className="text-[12px] sm:text-[13px] font-semibold mb-1.5 sm:mb-2 line-clamp-2 leading-tight">Rubber Gasket Seals (Pack of 5) - Durable sealing...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-3 sm:mb-4 lg:mb-2 flex items-center gap-1"><Box className="w-3 h-3 shrink-0 text-accent" /> KYS-486DVW</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-2.5 sm:mb-4 lg:mb-2">
                                                        <span className="text-lg sm:text-xl font-bold text-slate-800">₹450</span><span className="text-[11px] text-muted-foreground">/ 5 Count</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-[13px] sm:text-sm font-semibold h-9 sm:h-10 lg:h-9 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 2 */}
                                            <div className="border border-line/10 rounded-2xl p-4 md:p-5 lg:p-4 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all sm:flex">
                                                <div className="h-32 md:h-40 lg:h-auto lg:min-h-12 lg:flex-1 bg-transparent rounded-lg mb-5 md:mb-6 lg:mb-4 flex items-center justify-center p-4">
                                                    <div className="w-full h-full border-2 border-slate-200 grid grid-cols-4 gap-1 transform rotate-12"><div className="bg-slate-100"/><div className="bg-slate-100"/><div className="bg-slate-100"/><div className="bg-slate-100"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">20&quot;x20&quot;x1&quot; MERV 8 Air Filter - High-efficiency...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 lg:mb-2 flex items-center gap-1"><Box className="w-3 h-3 text-accent" /> KYS-Z5NZTI</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4 lg:mb-2">
                                                        <span className="text-xl font-bold text-slate-800">₹899</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 lg:h-9 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 3 */}
                                            <div className="border border-line/10 rounded-2xl p-4 md:p-5 lg:p-4 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all sm:flex">
                                                <div className="h-32 md:h-40 lg:h-auto lg:min-h-12 lg:flex-1 bg-transparent rounded-lg mb-5 md:mb-6 lg:mb-4 flex items-center justify-center p-4">
                                                     <div className="w-14 h-20 lg:w-12 lg:h-16 bg-slate-300/50 rounded-t-xl relative"><div className="absolute top-2 w-full h-3 bg-slate-400"/><div className="absolute -right-3 top-8 w-5 h-5 bg-slate-400 rounded-full"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">Air Pressure Regulator with Gauge - 1/4&quot; NPT</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 lg:mb-2 flex items-center gap-1"><Box className="w-3 h-3 text-accent" /> KYS-HY2741</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4 lg:mb-2">
                                                        <span className="text-xl font-bold text-slate-800">₹1,499</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 lg:h-9 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 4 */}
                                            <div className="border border-line/10 rounded-2xl p-5 lg:p-4 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all lg:flex">
                                                <div className="h-40 lg:h-auto lg:min-h-12 lg:flex-1 bg-transparent rounded-lg mb-6 lg:mb-4 flex items-center justify-center p-4">
                                                     <div className="w-20 h-10 bg-blue-500 rounded-xl relative mt-8 lg:mt-6"><div className="absolute -top-8 left-3 w-10 h-10 rounded-full bg-blue-600"/><div className="absolute -right-5 top-3 w-8 h-5 bg-slate-400/80 rounded-md"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">Industrial Electric Fume Pump Motor - 3 HP...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 lg:mb-2 flex items-center gap-1"><Box className="w-3 h-3 text-blue-500" /> KYS-B072K1</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4 lg:mb-2">
                                                        <span className="text-xl font-bold text-slate-800">₹24,500</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 lg:h-9 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    </motion.div>
                </div>
            </div>
        </section>
    )
}
