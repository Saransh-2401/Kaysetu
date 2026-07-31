import { ArrowRight, Check, MapPin, Search, Menu, MoreVertical, Plus, ShoppingCart, User, Bell } from "lucide-react";
import Icon from "@/components/Icon";
import AppDownloadButton from "@/components/AppDownloadButton";
import { Reveal, Counter } from "@/components/Motion";
import { Dashboard } from "@/components/AppScreens";
import {
  problemShift,
  stats,
  productReveal,
  builtFor,
  toolbox,
  closing,
} from "@/lib/content";

/* ================= Problem → Shift ================= */
export function ProblemShift() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
      <Reveal delay={60}>
        <p className="font-display text-2xl font-semibold leading-snug text-faint balance md:text-[2.1rem]">
          {problemShift.old}
        </p>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 font-display text-2xl font-bold leading-snug text-ink balance md:text-[2.1rem]">
          {problemShift.new}
        </p>
      </Reveal>
    </section>
  );
}

/* ================= Stat bar ================= */
export function StatBar() {
  return (
    <section className="border-y border-line bg-card/50">
      <div className="mx-auto max-w-[1600px] px-5 py-16">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {stats.items.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="bg-paper px-6 py-10 text-center">
              <div className="font-display text-[3rem] font-extrabold leading-none tracking-tight text-accent md:text-[3.6rem]">
                <Counter value={s.value} suffix={s.suffix} />
              </div>
              <p className="mx-auto mt-3 max-w-[17rem] text-[0.9rem] leading-snug text-muted">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}export function ProductReveal() {
  return (
    <section id="workspace" className="relative mx-auto w-[96%] max-w-[1600px] px-4 sm:px-8 py-12 lg:py-16 lg:px-20 overflow-visible rounded-[2.5rem] mt-12 border border-slate-200/50 shadow-sm bg-[#fbfbf9]">
      
      {/* Banner Background Image */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[2.5rem]">
        <img src="/map-bg.png" alt="Section Banner Background" className="w-full h-full object-fill opacity-100 mix-blend-normal" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12 max-w-6xl mx-auto">
        
        {/* Left Content (Text) */}
        <div className="w-full lg:w-1/2 flex flex-col items-start text-left mb-12 lg:mb-0">
          <Reveal delay={0}>
            <img src="/logo2.png" alt="KaySetu Logo" className="h-8 md:h-12 w-auto mb-6 drop-shadow-sm" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">Native iOS & Android</span>
            </div>
          </Reveal>
          
          <Reveal delay={100}>
            <h2 className="font-display text-[2.2rem] font-extrabold leading-tight md:text-[3.5rem] text-slate-900 tracking-tight mb-4">
              Mobile agent app
            </h2>
          </Reveal>
          
          <Reveal delay={200}>
            <p className="text-base md:text-lg text-slate-600 font-medium mb-8 leading-relaxed max-w-xl">
              Empower your field force with a unified mobile experience. Say goodbye to scattered WhatsApp updates and delayed end-of-day reports.
            </p>
          </Reveal>
          
          <Reveal delay={300}>
            <div className="flex flex-wrap gap-4">
              <AppDownloadButton />
            </div>
          </Reveal>
        </div>

        {/* Right Content (Phone and Floating Cards) */}
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
          <Reveal delay={400} className="relative z-10 flex justify-center perspective-[2000px] scale-[0.8] xs:scale-[0.85] lg:scale-[0.9] origin-center lg:origin-right">
            {/* Hover Group wrapper */}
            <div className="relative group flex justify-center w-[280px] xs:w-[300px] sm:w-[320px] h-[600px] xs:h-[640px]">
          
          {/* Front Phone (Light Mode) */}
          <div className="absolute top-0 w-full h-full bg-white rounded-[2.5rem] border-[8px] border-slate-900 shadow-[0_40px_80px_rgba(0,0,0,0.15)] overflow-hidden z-20 transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:shadow-[0_50px_100px_rgba(0,0,0,0.25)]">
             <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-3xl mx-16 z-20"></div>
             
             {/* App Header */}
             <div className="flex items-center justify-between px-6 pt-10 pb-4 border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-30">
               <div className="font-bold text-lg flex items-center gap-2"><span className="text-accent">KAY</span>SETU</div>
               <div className="flex gap-3 text-slate-400">
                 <Search className="w-5 h-5 hover:text-accent transition-colors cursor-pointer"/>
                 <Menu className="w-5 h-5 hover:text-accent transition-colors cursor-pointer"/>
               </div>
             </div>
             
             <div className="p-4 bg-slate-50 h-full overflow-hidden">
               <h3 className="font-bold text-slate-800 mb-4 px-2">Active Visits</h3>
               
               {/* Card 1 */}
               <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 relative">
                 <div className="flex gap-3 items-start relative z-10">
                   <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                     <MapPin className="w-4 h-4"/>
                   </div>
                   <div>
                     <div className="font-bold text-sm text-slate-800">Sharma Distributors</div>
                     <div className="text-xs text-slate-400 mt-1">Pending Check-in</div>
                     <div className="text-[10px] text-slate-500 mt-3 bg-slate-100 p-2 rounded-lg">
                       Target: ₹50,000 | Last Order: 12 days ago
                     </div>
                   </div>
                 </div>
               </div>

               {/* Card 2 */}
               <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 mb-4 relative z-20 transform scale-105 -ml-4 -mr-2 mt-6">
                 <div className="absolute -inset-1 bg-green-400 rounded-2xl blur-lg opacity-20 animate-pulse"></div>
                 <div className="flex gap-3 items-start relative z-10">
                   <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                     <Check className="w-4 h-4" strokeWidth={3}/>
                   </div>
                   <div className="flex-1">
                     <div className="flex justify-between items-start">
                       <div className="font-bold text-sm text-slate-800">New Metro Traders</div>
                       <MoreVertical className="w-4 h-4 text-slate-300"/>
                     </div>
                     <div className="text-xs text-slate-400 mt-1">Checked in • GPS Verified</div>
                     <div className="text-[10px] text-slate-500 mt-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                       Order Placed: ₹1,24,500 <br/>
                       14 items added to cart
                     </div>
                     <div className="flex justify-between items-center mt-3 text-[10px] text-slate-400">
                       <span>Today, 11:30 AM</span>
                       <span className="bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium shadow-sm">Completed</span>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Bottom Nav */}
             <div className="absolute bottom-0 inset-x-0 h-16 bg-white/90 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-4 z-30">
               <div className="flex flex-col items-center gap-1 text-accent"><MapPin className="w-5 h-5 fill-accent/20"/><span className="text-[9px] font-medium">Visits</span></div>
               <div className="flex flex-col items-center gap-1 text-slate-400"><ShoppingCart className="w-5 h-5"/><span className="text-[9px] font-medium">Orders</span></div>
               <div className="flex flex-col items-center gap-1 text-slate-400"><User className="w-5 h-5"/><span className="text-[9px] font-medium">Profile</span></div>
             </div>
          </div>
          
          {/* FLOATING CARDS (Staggered fade in) */}
          
          {/* FLOATING CARDS are decoration hung off the phone's centre line.
              Below xl there is no room beside the phone for them, so they are
              hidden rather than allowed to hang off the page. */}

          {/* Top Left Card */}
          <div className="absolute top-[20%] left-1/2 hidden -translate-x-[150%] -translate-y-1/2 w-48 z-30 pointer-events-none xl:block">
            <Reveal delay={500}>
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4"/>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">Feature</span>
                    <span className="text-sm font-bold text-slate-800">GPS Verified</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Bottom Left Card */}
          <div className="absolute top-[60%] left-1/2 hidden -translate-x-[130%] translate-y-[40%] w-56 z-30 pointer-events-none xl:block">
            <Reveal delay={700}>
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-4 h-4"/>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">Live sync</span>
                    <span className="text-sm font-bold text-slate-800">Instant Orders</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Orders push instantly to ERP without manual entry.</p>
              </div>
            </Reveal>
          </div>

          {/* Top Right Card */}
          <div className="absolute top-[30%] right-1/2 hidden translate-x-[125%] -translate-y-1/2 w-48 z-30 pointer-events-none xl:block 2xl:translate-x-[150%]">
            <Reveal delay={900}>
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4"/>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">Live</span>
                    <span className="text-sm font-bold text-slate-800">Route Tracking</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Bottom Right Card */}
          <div className="absolute top-[70%] right-1/2 hidden translate-x-[120%] -translate-y-[50%] w-56 z-30 pointer-events-none xl:block">
            <Reveal delay={1100}>
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4"/>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">Offline Ready</span>
                    <span className="text-sm font-bold text-slate-800">No Signal?</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">App works seamlessly offline and syncs when online.</p>
              </div>
            </Reveal>
          </div>

        </div>
      </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= Built for (segments) ================= */
export function BuiltFor() {
  return (
    <section id="built-for" className="mx-auto max-w-[1600px] px-5 py-20 md:py-28">
      <Reveal className="max-w-3xl">
        <h2 className="font-display text-[1.9rem] font-bold leading-[1.08] tracking-tight balance md:text-[2.7rem]">
          {builtFor.title}
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {builtFor.tiles.map((tile, i) => (
          <Reveal
            key={tile.tag}
            delay={i * 80}
            className="flex flex-col rounded-2xl border border-line bg-card p-7 transition-colors hover:border-accent/30"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon name={tile.icon} className="h-6 w-6" />
            </span>
            <span className="mt-5 font-mono text-[0.62rem] uppercase tracking-wider text-accent">
              {tile.tag}
            </span>
            <h3 className="mt-1 font-display text-xl font-bold leading-tight">{tile.title}</h3>
            <ul className="mt-4 space-y-2">
              {tile.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[0.9rem] text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.4} />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= Toolbox / integrations (restrained static strip) ================= */
export function Toolbox() {
  return (
    <section className="border-y border-line bg-card/40 py-16">
      <div className="mx-auto max-w-[1600px] px-5">
        <Reveal className="text-center">
          <h2 className="font-display text-[1.6rem] font-bold tracking-tight balance md:text-[2rem]">
            {toolbox.title}
          </h2>
        </Reveal>
        <Reveal delay={80} className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {toolbox.tools.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink/70"
            >
              {t}
            </span>
          ))}
        </Reveal>
        <p className="mt-5 text-center text-[0.72rem] text-faint">{toolbox.note}</p>
      </div>
    </section>
  );
}

/* ================= Closing CTA ================= */
export function ClosingCta() {
  return (
    <section id="demo" className="relative overflow-hidden bg-espresso">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_0%,rgba(0,150,136,0.1),transparent_70%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
        <Reveal>
          <h2 className="display-xl text-[2.2rem] leading-[1] text-card sm:text-[3rem] md:text-[3.8rem]">
            {closing.line}
            <br />
            <span className="text-accent-soft">{closing.lineAccent}</span>
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-card/70">
            {closing.body}
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={closing.primary.href}
              className="btn-primary group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.98rem] font-semibold"
            >
              {closing.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={closing.secondary.href}
              className="inline-flex items-center gap-2 rounded-full border border-card/25 px-6 py-3.5 text-[0.98rem] font-semibold text-card transition hover:bg-card/10"
            >
              {closing.secondary.label}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
