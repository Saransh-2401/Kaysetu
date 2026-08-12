'use client';
import Link from 'next/link'
import { ArrowRight, ChevronRight, Command, Activity, Box, Users, Search, Bell, Settings, Truck, MapPin, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RotatingWords } from '@/components/ui/rotating-words'

// The rolling half of the headline. Lower-case on purpose — it renders in the
// display serif italic, where caps read as shouting rather than editorial.
const HERO_ROLL_WORDS = [
    'field to finance',
    'order to cash',
    'factory to ledger',
    'shop to shelf',
    'lead to loyalty',
];

export function HeroSection() {
    return (
        <section id="top" className="relative isolate overflow-hidden">
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

                <div className="hero-spot absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paper/15 to-paper" />
            </div>

            <div className="mx-auto w-full max-w-[1600px] px-4 pt-10 sm:px-6 sm:pt-14 lg:pt-20">
                {/* ── Copy block, centred ─────────────────────────────── */}
                <div className="mx-auto max-w-4xl text-center">
                    {/* Fluid size, not breakpoint steps: the rolling line is a single
                        unbreakable token, so it has to fit at every width in between. */}
                    <h1 className="animate-fade-up font-display text-[clamp(2.1rem,6.2vw,4.4rem)] font-bold leading-[1.08] tracking-tight text-ink">
                        Run Your Entire Business
                        <span className="mt-1 block font-display text-[1.02em] font-medium italic leading-[1.15] text-accent sm:mt-2">
                            from One Place
                        </span>
                    </h1>

                    <p className="animate-fade-up delay-1 mx-auto mt-5 max-w-2xl text-[0.98rem] leading-relaxed text-muted sm:mt-6 sm:text-[1.08rem]">
                        KaySetu brings your sales, orders, distribution, inventory, workforce, and finances together—helping you stay in control and grow with confidence.
                    </p>

                    <div className="animate-fade-up delay-2 mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:mt-9 sm:gap-3">
                        <Link
                            href="/#packages"
                            className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.92rem] font-semibold sm:px-7 sm:text-[0.96rem]"
                        >
                            Explore packages
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/80 px-6 py-3 text-[0.92rem] font-semibold text-ink backdrop-blur-sm transition-colors hover:border-ink/30 hover:bg-white sm:px-7 sm:text-[0.96rem]"
                        >
                            Get a demo
                        </Link>
                    </div>
                </div>

                {/* ── The product, straight on, running off the bottom edge ── */}
                <div className="relative mx-auto mt-12 max-w-5xl sm:mt-14 lg:mt-16">
                    {/* soft glow pooling under the device */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-8 bottom-0 top-12 -z-10 rounded-[3rem] bg-accent/12 blur-3xl"
                    />

                    {/* bezel */}
                    <div className="rounded-t-[1.25rem] border border-b-0 border-white/10 bg-ink p-1.5 shadow-[0_-8px_50px_-24px_rgba(16,35,75,0.5),0_44px_90px_-34px_rgba(16,35,75,0.55)] sm:rounded-t-[1.85rem] sm:p-2.5">
                        <div className="h-[23rem] overflow-hidden rounded-t-[0.85rem] bg-white xs:h-[26rem] sm:h-[32rem] sm:rounded-t-[1.3rem] md:h-[36rem] lg:h-[38rem]">
                            {/* Inner Dashboard UI Mockup */}
                            <div className="relative flex h-full w-full overflow-hidden bg-white text-left">

                                {/* Sidebar */}
                                <div className="w-14 shrink-0 md:w-20 border-r border-line/20 bg-white hidden sm:flex flex-col items-center py-4 md:py-6 gap-4 md:gap-6 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                                    <div className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-lg mb-4">K</div>
                                    <div className="p-2 rounded-xl bg-accent/15 text-accent"><Command className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Box className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Activity className="w-5 h-5" /></div>
                                    <div className="p-2 text-muted-foreground hover:text-foreground"><Users className="w-5 h-5" /></div>
                                    <div className="mt-auto h-8 w-8 rounded-full bg-slate-200 border-2 border-background overflow-hidden">
                                        <img src="https://i.pravatar.cc/100?img=33" alt="Avatar" className="w-full h-full object-cover" />
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
                                    {/* Header */}
                                    <div className="h-11 sm:h-14 md:h-16 border-b border-line/40 flex items-center px-3 sm:px-6 justify-between gap-3">
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
                                    <div className="px-3 sm:px-6 pt-3 pb-2.5 sm:pt-6 sm:pb-4 flex justify-between items-end gap-4 border-b border-line/10">
                                        <div className="flex min-w-0 gap-6 md:gap-12">
                                            <div className="min-w-0">
                                                <p className="text-[0.65rem] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Department</p>
                                                <h2 className="text-base sm:text-xl md:text-2xl font-semibold flex items-center gap-1.5 sm:gap-2">Maintenance <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground rotate-90" /></h2>
                                            </div>
                                            <div className="hidden md:block">
                                                <p className="text-xs text-muted-foreground mb-1">Location</p>
                                                <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">Fontana, CA <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground rotate-90" /></h2>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex flex-col items-end shrink-0">
                                            <p className="text-xs text-muted-foreground mb-2">Shared with</p>
                                            <div className="flex -space-x-2">
                                                <img className="w-6 h-6 rounded-full border-2 border-background" src="https://i.pravatar.cc/100?img=1" alt="Avatar" />
                                                <img className="w-6 h-6 rounded-full border-2 border-background" src="https://i.pravatar.cc/100?img=2" alt="Avatar" />
                                                <img className="w-6 h-6 rounded-full border-2 border-background" src="https://i.pravatar.cc/100?img=3" alt="Avatar" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid */}
                                    <div className="flex-1 min-h-0 p-3 sm:p-5 md:p-8 overflow-hidden">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 h-full">
                                            {/* Card 1 */}
                                            <div className="border border-line/10 rounded-2xl p-3 sm:p-4 md:p-5 flex flex-col min-w-0 bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all">
                                                <div className="h-20 sm:h-32 md:h-40 bg-transparent rounded-lg mb-3 sm:mb-5 md:mb-6 flex items-center justify-center">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-4 border-red-400/20 grid grid-cols-2 gap-1"><div className="rounded-full border-4 border-red-500"/><div className="rounded-full border-4 border-red-500"/><div className="rounded-full border-4 border-red-500"/></div>
                                                </div>
                                                <h3 className="text-[12px] sm:text-[13px] font-semibold mb-1.5 sm:mb-2 line-clamp-2 leading-tight">Rubber Gasket Seals (Pack of 5) - Durable sealing...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-3 sm:mb-4 flex items-center gap-1"><Box className="w-3 h-3 shrink-0 text-accent" /> KYS-486DVW</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-2.5 sm:mb-4">
                                                        <span className="text-lg sm:text-xl font-bold text-slate-800">$5.00</span><span className="text-[11px] text-muted-foreground">/ 5 Count</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-[13px] sm:text-sm font-semibold h-9 sm:h-10 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 2 */}
                                            <div className="border border-line/10 rounded-2xl p-4 md:p-5 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all sm:flex">
                                                <div className="h-32 md:h-40 bg-transparent rounded-lg mb-5 md:mb-6 flex items-center justify-center p-4">
                                                    <div className="w-full h-full border-2 border-slate-200 grid grid-cols-4 gap-1 transform rotate-12"><div className="bg-slate-100"/><div className="bg-slate-100"/><div className="bg-slate-100"/><div className="bg-slate-100"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">20&quot;x20&quot;x1&quot; MERV 8 Air Filter - High-efficiency...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1"><Box className="w-3 h-3 text-accent" /> KYS-Z5NZTI</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4">
                                                        <span className="text-xl font-bold text-slate-800">$10.00</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 3 */}
                                            <div className="border border-line/10 rounded-2xl p-4 md:p-5 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all sm:flex">
                                                <div className="h-32 md:h-40 bg-transparent rounded-lg mb-5 md:mb-6 flex items-center justify-center p-4">
                                                     <div className="w-14 h-20 bg-slate-300/50 rounded-t-xl relative"><div className="absolute top-2 w-full h-3 bg-slate-400"/><div className="absolute -right-3 top-8 w-5 h-5 bg-slate-400 rounded-full"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">Air Pressure Regulator with Gauge - 1/4&quot; NPT</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1"><Box className="w-3 h-3 text-accent" /> KYS-HY2741</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4">
                                                        <span className="text-xl font-bold text-slate-800">$18.00</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>

                                            {/* Card 4 */}
                                            <div className="border border-line/10 rounded-2xl p-5 hidden min-w-0 flex-col bg-white shadow-sm hover:shadow-md hover:border-accent/30 transition-all lg:flex">
                                                <div className="h-40 bg-transparent rounded-lg mb-6 flex items-center justify-center p-4">
                                                     <div className="w-20 h-10 bg-blue-500 rounded-xl relative mt-8"><div className="absolute -top-8 left-3 w-10 h-10 rounded-full bg-blue-600"/><div className="absolute -right-5 top-3 w-8 h-5 bg-slate-400/80 rounded-md"/></div>
                                                </div>
                                                <h3 className="text-[13px] font-semibold mb-2 line-clamp-2 leading-tight">Industrial Electric Fume Pump Motor - 3 HP...</h3>
                                                <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1"><Box className="w-3 h-3 text-blue-500" /> KYS-B072K1</p>
                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-1 mb-4">
                                                        <span className="text-xl font-bold text-slate-800">$300.00</span><span className="text-[11px] text-muted-foreground">/ Each</span>
                                                    </div>
                                                    <Button variant="secondary" className="w-full text-sm font-semibold h-10 bg-[#eef2ff] text-accent hover:bg-accent hover:text-white rounded-xl">+ Add to Cart</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Detail panel breaking out of the frame ─────────── */}
                    <div
                        aria-hidden
                        className="animate-fade-up delay-3 absolute -right-4 top-[12.5rem] hidden w-[17rem] rounded-2xl border border-line bg-white p-4 shadow-float lg:block xl:-right-16"
                    >
                        <div className="flex items-center gap-3">
                            <img src="https://i.pravatar.cc/100?img=12" alt="" className="h-9 w-9 rounded-full object-cover" />
                            <div className="min-w-0">
                                <p className="truncate text-[0.82rem] font-semibold text-ink">Rahul Verma</p>
                                <p className="flex items-center gap-1 truncate text-[0.7rem] text-muted">
                                    <MapPin className="h-3 w-3 shrink-0 text-accent" /> Field sales · Jaipur beat
                                </p>
                            </div>
                        </div>

                        <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-[0.72rem] leading-snug text-accent-ink">
                            3 orders are waiting on approval. Clear them to dispatch today.
                        </p>

                        <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-faint">Activity</p>
                        <ul className="mt-2 space-y-2.5">
                            <li className="flex items-center gap-2.5">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><PackageCheck className="h-3.5 w-3.5" /></span>
                                <span className="min-w-0 flex-1 truncate text-[0.74rem] text-ink">Order #KS-2041 packed</span>
                                <span className="shrink-0 text-[0.66rem] text-faint">2h ago</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600"><Truck className="h-3.5 w-3.5" /></span>
                                <span className="min-w-0 flex-1 truncate text-[0.74rem] text-ink">Dispatch to Route 7</span>
                                <span className="shrink-0 text-[0.66rem] text-faint">Today</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"><Box className="h-3.5 w-3.5" /></span>
                                <span className="min-w-0 flex-1 truncate text-[0.74rem] text-ink">Stock request raised</span>
                                <span className="shrink-0 text-[0.66rem] text-faint">Yesterday</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}
