'use client';
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Menu, X, Hexagon, Triangle, Circle, Square, Command, Option, Activity, Box, Users, Search, Bell, Settings, ShieldCheck, RefreshCw, Smartphone, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { TextRoll } from '@/components/ui/text-roll'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { cn } from '@/lib/utils'

const transitionVariants: any = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
}

const HERO_ROLL_WORDS = [
    'END-TO-END.',
    'FIELD-TO-FINANCE.',
    'ORDER-TO-CASH.',
    'FACTORY-TO-LEDGER.',
    'SHOP-TO-SHELF.',
];

// How long the longest word exit takes: (maxLetters-1)*0.1 + 0.5 ≈ 1.7s → round to 1800ms
const EXIT_MS = 1800;

export function HeroSection() {
    // displayIndex = what is currently fully visible
    const [displayIndex, setDisplayIndex] = useState(0);
    // rollKey changes whenever we want to trigger the roll-in animation
    const [rollKey, setRollKey] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            // Step 1: trigger the roll-OUT of the current word by switching to next
            setDisplayIndex((prev) => (prev + 1) % HERO_ROLL_WORDS.length);
            setRollKey((k) => k + 1);
        }, 3200);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="overflow-hidden">
                <div aria-hidden className="absolute inset-0 -z-20 w-full h-full pointer-events-none overflow-hidden flex items-center justify-center">
                    <img 
                        src="/hero-custom-bg.png" 
                        alt="Background" 
                        className="w-[110%] max-w-none h-auto min-h-full object-cover object-center"
                    />
                </div>
                <section>
                    <div className="relative">
                            <ContainerScroll
                                titleComponent={
                                    <div className="mx-auto flex w-full flex-col items-center justify-center space-y-2.5 px-4 pb-2 sm:space-y-3 md:-mt-12">
                                        <div className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[0.78rem] font-medium text-muted-foreground sm:gap-2 sm:text-sm">
                                            <span>Unify your business operations</span>
                                            <ArrowRight className="hidden h-3.5 w-3.5 sm:block sm:h-4 sm:w-4" />
                                            <span className="text-foreground">Unlock growth.</span>
                                        </div>
                                        {/* Fluid size, not breakpoint steps: the rolling word is a single
                                            unbreakable token, so it has to fit at every width in between. */}
                                        <h1 className="max-w-6xl text-center font-medium leading-[1.12] tracking-tight text-[clamp(1.4rem,7.2vw,4.75rem)]">
                                            <span className="block uppercase tracking-tight text-accent">SMARTER OPERATIONS</span>
                                            <span className="my-0.5 block uppercase tracking-tight text-ink md:my-2">FROM</span>
                                            <span className="block whitespace-nowrap uppercase tracking-tight text-ink">
                                                <TextRoll key={rollKey}>
                                                    {HERO_ROLL_WORDS[displayIndex]}
                                                </TextRoll>
                                            </span>
                                        </h1>
                                    </div>
                                }
                            >
                                {/* Inner Dashboard UI Mockup */}
                                <div className="relative overflow-hidden rounded-2xl border border-line/10 flex h-full w-full text-left bg-white">
                                    
                                    {/* Sidebar */}
                                    <div className="w-14 shrink-0 md:w-20 border-r border-line/20 bg-white hidden sm:flex flex-col items-center py-4 md:py-6 gap-4 md:gap-6 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                                        <div className="h-8 w-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg mb-4">K</div>
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
                        </ContainerScroll>
                    </div>
                </section>

            </main>
    )
}
