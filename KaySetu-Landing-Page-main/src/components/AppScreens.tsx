import Icon from "@/components/Icon";
import {
  Bell,
  BatteryMedium,
  Camera,
  Check,
  ChevronRight,
  Circle,
  House,
  Lock,
  MapPin,
  Navigation,
  ReceiptText,
  Route,
  SignalHigh,
  User,
  Wifi,
} from "lucide-react";

/* ==================================================================
   Coded KaySetu UI mockups — realistic product screens rendered in code.
   Formatted for laptop-sized desktop frames & sleek iPhone mobile frame.
   ================================================================== */

export function Frame({
  title,
  path = "",
  children,
  className = "",
}: {
  title: string;
  path?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] overflow-hidden rounded-[20px] border border-line bg-card w-full ${className}`}
    >
      {/* Laptop browser chrome */}
      <div className="flex items-center gap-3 border-b border-line bg-paper/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-card px-3 py-1.5 shadow-inner">
          <Lock className="h-3 w-3 shrink-0 text-faint" />
          <span className="truncate font-mono text-[0.7rem] font-medium text-muted">
            app.kaysetu.in{path}
          </span>
        </div>
        <span className="hidden items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-accent sm:flex font-semibold">
          <Circle className="live-dot h-2 w-2 fill-current" /> Live
        </span>
      </div>
      {/* App bar with screen title */}
      <div className="flex items-center justify-between border-b border-line/60 bg-paper/30 px-5 py-2.5">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-ink/80">{title}</span>
        <span className="font-mono text-[0.65rem] text-faint">v2.4 · today</span>
      </div>
      <div className="p-3.5 sm:p-5 md:p-6 min-h-[260px] sm:min-h-[300px] md:min-h-[340px] flex flex-col justify-center">{children}</div>
    </div>
  );
}

/* -- 1 · Lead & CRM pipeline (kanban) ----------------------------- */
export function LeadsBoard() {
  const cols = [
    { name: "New", tint: "bg-accent", cards: [["Sharma Traders", "₹1.2L"], ["Metro Retail", "₹80k"]] },
    { name: "Contacted", tint: "bg-accent/70", cards: [["Verma & Co", "₹2.4L"]] },
    { name: "Quoted", tint: "bg-accent/50", cards: [["Nova Foods", "₹3.1L"], ["Rajesh Dist.", "₹95k"]] },
    { name: "Won", tint: "bg-emerald-500", cards: [["Krishna Agencies", "₹4.6L"]] },
  ];
  return (
    <Frame title="Lead & CRM · Pipeline" path="/crm/pipeline">
      {/* Four kanban columns are ~60px each on a phone — pair them up instead. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 py-2">
        {cols.map((c) => (
          <div key={c.name} className="rounded-xl bg-paper/80 p-2.5 sm:p-3 flex flex-col min-w-0 min-h-[110px] sm:min-h-[220px]">
            <div className="mb-2.5 sm:mb-3 flex items-center justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${c.tint}`} />
                <span className="truncate text-[0.72rem] sm:text-[0.75rem] font-bold text-ink">{c.name}</span>
              </div>
              <span className="shrink-0 text-[0.65rem] font-mono text-muted">{c.cards.length}</span>
            </div>
            <div className="space-y-2.5 flex-1">
              {c.cards.map(([n, v]) => (
                <div key={n} className="rounded-lg border border-line bg-card p-2.5 shadow-sm hover:border-accent/40 transition-colors">
                  <div className="truncate text-[0.72rem] font-semibold text-ink">{n}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[0.68rem] font-bold text-accent">{v}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* -- 2 · Field visit — live map + verified check-in --------------- */

/* Streets, route and pins all live in one 500×300 space, stretched to the
   frame with preserveAspectRatio="none". Pin coordinates are taken straight
   off the route path, so every marker sits exactly on the line at any width. */
const MAP_W = 500;
const MAP_H = 300;
const MAP_ROUTE = "M40 170 C 120 150, 150 105, 230 100 S 360 75, 440 45";
const MAP_STOPS = [
  { x: 40, y: 170, label: "Sharma Traders" },
  { x: 230, y: 100, label: "Metro Retail" },
  { x: 440, y: 45, label: "Nova Foods", current: true },
];

export function FieldMap() {
  return (
    <Frame title="Field Sales · Live Map" path="/field/live">
      <div className="relative h-56 md:h-64 overflow-hidden rounded-xl border border-line bg-[radial-gradient(circle_at_30%_30%,#e6f5f3,#eef2f5)] shadow-inner">
        {/* SVG streets */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* vectorEffect keeps strokes even after the non-uniform stretch */}
          <g stroke="var(--color-line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
            <path d="M0 60 H500" vectorEffect="non-scaling-stroke" />
            <path d="M0 140 H500" vectorEffect="non-scaling-stroke" />
            <path d="M0 220 H500" vectorEffect="non-scaling-stroke" />
            <path d="M85 0 V300" vectorEffect="non-scaling-stroke" />
            <path d="M190 0 V300" vectorEffect="non-scaling-stroke" />
            <path d="M295 0 V300" vectorEffect="non-scaling-stroke" />
            <path d="M400 0 V300" vectorEffect="non-scaling-stroke" />
          </g>
          {/* Faint road bed under the animated trail */}
          <path
            d={MAP_ROUTE}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.16"
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={MAP_ROUTE}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3.5"
            strokeDasharray="8 8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ animation: "route-dash 1.2s linear infinite" }}
          />
        </svg>
        {MAP_STOPS.map((s) => (
          <span
            key={s.label}
            title={s.label}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md ${
              s.current
                ? "h-7 w-7 bg-accent text-card ring-4 ring-card"
                : "h-5 w-5 bg-card text-accent ring-2 ring-accent/40"
            }`}
            style={{ left: `${(s.x / MAP_W) * 100}%`, top: `${(s.y / MAP_H) * 100}%` }}
          >
            {/* ping sits below the glyph: both are positioned, so DOM order decides paint order */}
            {s.current && (
              <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" aria-hidden />
            )}
            {s.current ? (
              <MapPin className="relative h-4 w-4" strokeWidth={2} />
            ) : (
              <Check className="relative h-3 w-3" strokeWidth={3} />
            )}
          </span>
        ))}
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex items-center gap-2.5 sm:gap-3 rounded-xl border border-line bg-card/95 p-2.5 sm:p-3 shadow-lg backdrop-blur">
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-accent/15 text-accent shrink-0">
            <Icon name="BadgeCheck" className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[0.72rem] sm:text-[0.75rem] font-bold text-ink">Check-in verified</div>
            <div className="text-[0.65rem] sm:text-[0.68rem] text-muted font-medium">GPS + selfie + shop photo · 10:24 AM</div>
          </div>
          <span className="ml-auto hidden shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-bold text-emerald-600 xs:inline-block">
            On route
          </span>
        </div>
      </div>
    </Frame>
  );
}

/* -- 3 · Quote-to-cash -------------------------------------------- */
export function QuoteToCash() {
  const steps = ["Quotation", "Sales order", "GST invoice"];
  const lines = [["HDPE Pipe 40mm", "120", "₹42,000"], ["Coupler set", "60", "₹9,600"], ["Fittings kit", "24", "₹7,200"]];
  return (
    <Frame title="Quote-to-Cash" path="/sales/quote">
      <div className="mb-4 flex items-center gap-1.5 sm:gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${
                i < 2 ? "bg-accent text-card shadow-sm" : "border border-accent text-accent"
              }`}
            >
              {i + 1}
            </span>
            <span className="truncate text-[0.65rem] sm:text-[0.72rem] font-bold text-ink">{s}</span>
            {/* The connector is the first thing to go when space is tight */}
            {i < steps.length - 1 && <span className="hidden h-0.5 flex-1 bg-line sm:block" />}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line shadow-sm">
        {/* Fixed qty/amount tracks — justify-between would let the middle
            column drift with each product name's width. */}
        {lines.map(([n, q, amt], i) => (
          <div
            key={n}
            className={`grid grid-cols-[minmax(0,1fr)_2.75rem_4.5rem] items-center gap-2 px-3 sm:px-4 py-2.5 text-[0.68rem] sm:text-[0.72rem] ${
              i % 2 ? "bg-paper/60" : "bg-card"
            }`}
          >
            <span className="min-w-0 truncate font-semibold text-ink">{n}</span>
            <span className="text-right font-medium tabular-nums text-muted">×{q}</span>
            <span className="text-right font-bold tabular-nums text-ink">{amt}</span>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_4.5rem] items-center gap-2 border-t border-line bg-accent/10 px-3 sm:px-4 py-3">
          <span className="col-span-2 text-[0.7rem] font-bold text-ink">Total incl. GST (18%)</span>
          <span className="text-right text-[0.8rem] font-bold tabular-nums text-accent">₹69,384</span>
        </div>
      </div>
    </Frame>
  );
}

/* -- 4 · Inventory & warehouse ------------------------------------ */
export function InventoryGrid() {
  const rows = [
    ["HDPE Pipe 40mm", "Bengaluru · A2", 62, "In stock"],
    ["Coupler set", "Bengaluru · B1", 14, "Low"],
    ["Fittings kit", "Hyderabad · C3", 88, "In stock"],
    ["Valve 2\"", "Bengaluru · A5", 6, "Reorder"],
  ];
  return (
    <Frame title="Inventory · Warehouse" path="/inventory">
      <div className="space-y-2.5">
        {rows.map(([name, bin, pct, status]) => {
          const low = status !== "In stock";
          return (
            <div key={name as string} className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[0.75rem] font-bold text-ink">{name}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold ${
                    low ? "bg-accent/15 text-accent" : "bg-emerald-500/15 text-emerald-600"
                  }`}
                >
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${low ? "bg-accent" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[0.65rem] font-mono text-muted">{bin}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* -- 5 · Command center dashboard -------------------------------- */
export function Dashboard() {
  const kpis = [
    ["Leads today", "42", "MapPin"],
    ["Field visits", "18", "Navigation"],
    ["Orders MTD", "₹4.2L", "ReceiptText"],
    ["Collections", "₹3.1L", "Wallet"],
  ];
  const bars = [40, 62, 48, 78, 56, 88, 70, 96, 64, 82];
  const feed = [
    ["Lead won — Krishna Agencies", "₹4.6L"],
    ["Visit verified — R. Kumar", "Ward 12"],
    ["Invoice raised — Nova Foods", "₹3.1L"],
  ];
  return (
    <Frame title="KaySetu · Command Center" path="/dashboard" className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {kpis.map(([label, val, icon]) => (
          <div key={label} className="rounded-xl border border-line bg-paper/70 p-2.5 sm:p-3 shadow-sm min-w-0">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-accent/15 text-accent mb-1.5 sm:mb-2">
              <Icon name={icon as string} className="h-4 w-4" />
            </span>
            {/* Sans + tabular: these are product-UI KPI values, not editorial
                headings — the serif's old-style figures read as misaligned. */}
            <div className="text-lg sm:text-xl font-bold tabular-nums tracking-tight text-ink">{val}</div>
            <div className="text-[0.65rem] font-medium text-muted truncate">{label}</div>
          </div>
        ))}
      </div>
      {/* Chart + feed sit side by side only once there's room for both. */}
      <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3 sm:gap-4">
        <div className="rounded-xl border border-line p-3 sm:p-4 bg-card shadow-sm min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[0.7rem] font-bold text-ink">Revenue · this month</span>
            <span className="text-[0.65rem] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">+18%</span>
          </div>
          <div className="flex h-20 sm:h-28 items-end gap-1.5 sm:gap-2">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-accent/50 to-accent"
                style={{
                  height: `${h}%`,
                  transformOrigin: "bottom",
                }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line p-3 sm:p-4 bg-card shadow-sm min-w-0">
          <span className="text-[0.7rem] font-bold text-ink">Live activity</span>
          <div className="mt-3 space-y-2.5">
            {feed.map(([t, v]) => (
              <div key={t} className="flex items-start gap-2">
                <Circle className="live-dot mt-1 h-2 w-2 shrink-0 fill-accent text-accent" />
                <div className="leading-tight">
                  <div className="text-[0.68rem] font-semibold text-ink">{t}</div>
                  <div className="text-[0.62rem] text-muted">{v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* -- 6 · Mobile field app (sleek iPhone frame) -------------------- */
const ROUTE_STOPS = [
  {
    name: "Sharma Traders",
    area: "Jayanagar · 4th Blk",
    meta: "9:15",
    state: "done" as const,
  },
  {
    name: "Metro Retail",
    area: "Ward 12 · 1.2 km",
    meta: "Now",
    state: "now" as const,
  },
  {
    name: "Verma & Co",
    area: "BTM Layout · 3.8 km",
    meta: "10:40",
    state: "next" as const,
  },
];

const ROUTE_STATS = [
  ["12.4", "km driven"],
  ["₹86k", "orders"],
  ["2", "pending"],
];

const TABS = [
  { icon: House, label: "Home" },
  { icon: Route, label: "Route", active: true },
  { icon: ReceiptText, label: "Orders" },
  { icon: User, label: "Me" },
];

export function MobileApp() {
  return (
    <div className="relative mx-auto w-[252px] xs:w-[280px] sm:w-[310px] max-w-full">
      {/* Side buttons — small realism cue on the bezel */}
      <span className="absolute -left-[4px] top-[104px] h-7 w-[6px] rounded-l-md bg-slate-700" />
      <span className="absolute -left-[4px] top-[140px] h-12 w-[6px] rounded-l-md bg-slate-700" />
      <span className="absolute -right-[4px] top-[124px] h-16 w-[6px] rounded-r-md bg-slate-700" />

      <div className="relative rounded-[44px] border-[8px] border-slate-900 bg-slate-900 p-1 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-800">
        {/* Dynamic Island Notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-4.5 w-20 rounded-full bg-black z-30 flex items-center justify-end px-2">
          <div className="h-2 w-2 rounded-full bg-slate-800/80" />
        </div>

        <div className="overflow-hidden rounded-[36px] bg-paper">
          {/* Header — status bar, rep identity and the day's progress */}
          <div className="bg-[linear-gradient(155deg,#0b1c3d_0%,#12294f_45%,#00695f_100%)] px-3 xs:px-4 pt-3 pb-7 text-card">
            <div className="flex items-center justify-between text-[0.68rem] font-bold tracking-wide">
              <span>9:41</span>
              <span className="flex items-center gap-1 text-card/85">
                <SignalHigh className="h-3.5 w-3.5" strokeWidth={2.2} />
                <Wifi className="h-3.5 w-3.5" strokeWidth={2.2} />
                <BatteryMedium className="h-4 w-4" strokeWidth={2.2} />
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 xs:h-9 xs:w-9 shrink-0 items-center justify-center rounded-full bg-card/15 text-[0.65rem] xs:text-[0.7rem] font-bold ring-1 ring-card/25">
                RK
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[0.75rem] xs:text-[0.8rem] font-bold">Ravi Kumar</div>
                <div className="truncate text-[0.55rem] xs:text-[0.6rem] font-medium text-card/60">
                  Field exec · BLR South
                </div>
              </div>
              <span className="relative ml-auto flex h-7 w-7 xs:h-8 xs:w-8 shrink-0 items-center justify-center rounded-full bg-card/10 ring-1 ring-card/15">
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-[#123256]" />
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-card/10 p-2.5 xs:p-3 ring-1 ring-card/15 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.72rem] xs:text-[0.75rem] font-bold">Today&apos;s route</span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-emerald-300">
                  <Circle className="live-dot h-1.5 w-1.5 fill-emerald-300 text-emerald-300" /> Synced
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card/15">
                  <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-300 to-teal-200" />
                </div>
                <span className="shrink-0 font-mono text-[0.6rem] font-bold text-card/80">3/6</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 border-t border-card/10 pt-2.5">
                {ROUTE_STATS.map(([val, label]) => (
                  <div key={label} className="min-w-0 text-center">
                    <div className="text-[0.74rem] xs:text-[0.78rem] font-bold leading-none">{val}</div>
                    <div className="mt-1 truncate text-[0.5rem] xs:text-[0.52rem] font-medium uppercase tracking-wide text-card/55">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Route sheet — lifted over the header for depth */}
          <div className="-mt-4 rounded-t-3xl bg-paper px-3 xs:px-3.5 pb-3 pt-4">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[0.7rem] xs:text-[0.72rem] font-bold text-ink">Next stops</span>
              <span className="flex items-center gap-0.5 text-[0.6rem] xs:text-[0.62rem] font-bold text-accent">
                View all <ChevronRight className="h-3 w-3" />
              </span>
            </div>

            <div className="mt-2.5 space-y-2.5">
              {ROUTE_STOPS.map((s, i) => {
                const done = s.state === "done";
                const now = s.state === "now";
                return (
                  <div key={s.name} className="relative">
                    <div
                      className={`rounded-2xl border bg-card p-2 xs:p-2.5 transition-transform hover:-translate-y-0.5 ${
                        now
                          ? "border-accent/40 shadow-[0_10px_20px_-12px_rgba(0,150,136,0.75)] ring-2 ring-accent/10"
                          : "border-line shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2 xs:gap-2.5">
                        <span
                          className={`flex h-7 w-7 xs:h-8 xs:w-8 shrink-0 items-center justify-center rounded-xl ${
                            done
                              ? "bg-emerald-500/15 text-emerald-600"
                              : now
                              ? "bg-accent text-card shadow-sm"
                              : "bg-paper text-muted"
                          }`}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5 xs:h-4 xs:w-4" strokeWidth={3} />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 xs:h-4 xs:w-4" strokeWidth={2.2} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div
                            className={`truncate text-[0.7rem] xs:text-[0.76rem] font-bold ${
                              done ? "text-muted" : "text-ink"
                            }`}
                          >
                            {s.name}
                          </div>
                          <div className="truncate text-[0.55rem] xs:text-[0.6rem] font-medium text-faint">
                            {s.area}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 xs:px-2 py-0.5 text-[0.55rem] xs:text-[0.58rem] font-bold ${
                            now
                              ? "bg-accent/12 text-accent"
                              : done
                              ? "bg-emerald-500/12 text-emerald-600"
                              : "bg-paper text-muted"
                          }`}
                        >
                          {s.meta}
                        </span>
                      </div>

                      {/* Only the live stop carries actions — keeps the hierarchy readable */}
                      {now && (
                        <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2">
                          <span className="rounded-md bg-paper px-1.5 py-0.5 text-[0.55rem] font-bold text-muted">
                            Collect ₹42,000
                          </span>
                          <span className="ml-auto flex items-center gap-1 text-[0.58rem] font-bold text-accent">
                            <Navigation className="h-2.5 w-2.5 fill-current" /> Navigate
                          </span>
                        </div>
                      )}
                    </div>
                    {/* dashed connector drops through the gap to the next stop */}
                    {i < ROUTE_STOPS.length - 1 && (
                      <span className="absolute -bottom-2.5 left-[22px] xs:left-[26px] h-2.5 border-l border-dashed border-line" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 xs:gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-accent-ink to-accent px-3 xs:px-4 py-3 text-[0.7rem] xs:text-[0.78rem] font-bold text-card shadow-[0_12px_22px_-10px_rgba(0,150,136,0.85)] transition-transform hover:scale-[1.02] active:scale-98">
              <Camera className="h-3.5 w-3.5 xs:h-4 xs:w-4 shrink-0" strokeWidth={2.2} /> Check in with GPS + selfie
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[0.55rem] font-medium text-faint">
              <MapPin className="h-2.5 w-2.5" /> Location locked · accuracy 4 m
            </div>
          </div>

          {/* Bottom tab bar */}
          <div className="border-t border-line bg-card px-2 pt-2 pb-1.5">
            <div className="flex items-end justify-around">
              {TABS.map(({ icon: TabIcon, label, active }) => (
                <span
                  key={label}
                  className={`flex flex-col items-center gap-1 px-1 ${
                    active ? "text-accent" : "text-faint"
                  }`}
                >
                  <TabIcon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                  <span className="text-[0.5rem] font-bold uppercase tracking-wide">{label}</span>
                  <span
                    className={`h-0.5 w-4 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                  />
                </span>
              ))}
            </div>
            {/* iPhone Home Bar */}
            <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-slate-400/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
