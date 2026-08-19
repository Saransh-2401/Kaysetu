import React from "react";
import {
  Check,
  CloudOff,
  MapPin,
  Menu,
  MoreVertical,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
} from "lucide-react";
import {
  ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

/* The screens are rendered rather than screenshotted - there are no captures of
   the agent app in /public, and live markup stays crisp at every scale the
   carousel fans the phones to. */

function ScreenChrome({
  title,
  tab,
  children,
}: {
  title: string;
  tab: "visits" | "orders" | "profile";
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-5 pb-3 pt-9 backdrop-blur-md">
        <div className="flex items-center gap-1 text-[0.95rem] font-bold">
          <span className="text-accent">KAY</span>SETU
        </div>
        <div className="flex gap-2.5 text-slate-400">
          <Search className="h-4 w-4" />
          <Menu className="h-4 w-4" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <h3 className="mb-3 px-1 text-[0.8rem] font-bold text-slate-800">{title}</h3>
        {children}
      </div>

      <div className="flex h-14 shrink-0 items-center justify-around border-t border-slate-100 bg-white/90 px-3 backdrop-blur-md">
        {[
          { key: "visits", icon: MapPin, label: "Visits" },
          { key: "orders", icon: ShoppingCart, label: "Orders" },
          { key: "profile", icon: User, label: "Profile" },
        ].map(({ key, icon: TabIcon, label }) => (
          <div
            key={key}
            className={`flex flex-col items-center gap-1 ${tab === key ? "text-accent" : "text-slate-400"}`}
          >
            <TabIcon className={`h-4 w-4 ${tab === key ? "fill-accent/20" : ""}`} />
            <span className="text-[8px] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const appScreens: ImageItem[] = [
  {
    alt: "Active visits with GPS check-in",
    content: (
      <ScreenChrome title="Active Visits" tab="visits">
        <div className="mb-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[0.72rem] font-bold text-slate-800">Sharma Distributors</div>
              <div className="mt-0.5 text-[0.62rem] text-slate-400">Pending Check-in</div>
              <div className="mt-2 rounded-lg bg-slate-100 p-1.5 text-[0.55rem] text-slate-500">
                Target: ₹50,000 · Last order 12 days ago
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-slate-100 bg-white p-3 shadow-lg">
          <div className="absolute -inset-1 animate-pulse rounded-2xl bg-green-400 opacity-20 blur-lg" />
          <div className="relative flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between">
                <div className="text-[0.72rem] font-bold text-slate-800">New Metro Traders</div>
                <MoreVertical className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              </div>
              <div className="mt-0.5 text-[0.62rem] text-slate-400">Checked in • GPS Verified</div>
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-[0.55rem] leading-relaxed text-slate-500">
                Order placed: ₹1,24,500
                <br />
                14 items added to cart
              </div>
              <div className="mt-2 flex items-center justify-between text-[0.55rem] text-slate-400">
                <span>Today, 11:30 AM</span>
                <span className="rounded-full bg-green-50 px-1.5 py-0.5 font-medium text-green-600">
                  Completed
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">
          Up next
        </div>
        {[
          { name: "Anand Hardware", meta: "7.8 km · 12:15 PM" },
          { name: "Verma Trading Co.", meta: "11.2 km · 2:00 PM" },
        ].map((stop) => (
          <div
            key={stop.name}
            className="mt-2 flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MapPin className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[0.66rem] font-semibold text-slate-700">{stop.name}</div>
              <div className="text-[0.55rem] text-slate-400">{stop.meta}</div>
            </div>
          </div>
        ))}
      </ScreenChrome>
    ),
  },
  {
    alt: "Order booking that pushes straight to the ERP",
    content: (
      <ScreenChrome title="New Order" tab="orders">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 text-[0.62rem] font-medium text-slate-400">New Metro Traders</div>
          {[
            { name: "Rubber Gasket Seals", qty: "5 × ₹5.00", total: "₹25" },
            { name: "MERV 8 Air Filter", qty: "12 × ₹10.00", total: "₹120" },
            { name: "Pressure Regulator", qty: "3 × ₹18.00", total: "₹54" },
          ].map((line) => (
            <div
              key={line.name}
              className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"
            >
              <div className="min-w-0 pr-2">
                <div className="truncate text-[0.66rem] font-semibold text-slate-700">{line.name}</div>
                <div className="text-[0.55rem] text-slate-400">{line.qty}</div>
              </div>
              <span className="shrink-0 text-[0.66rem] font-bold text-slate-800">{line.total}</span>
            </div>
          ))}
          <button className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-1.5 text-[0.6rem] font-semibold text-slate-400">
            <Plus className="h-3 w-3" /> Add item
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-slate-900 p-3 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[0.6rem] text-white/60">Order total</span>
            <span className="text-[0.95rem] font-bold">₹1,24,500</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-[0.55rem] text-white/80">
            <RefreshCw className="h-3 w-3 shrink-0" /> Synced to ERP, no manual entry
          </div>
        </div>
      </ScreenChrome>
    ),
  },
  {
    alt: "Live route tracking and beat plan",
    content: (
      <ScreenChrome title="Today's Beat" tab="visits">
        <div className="relative mb-3 h-32 overflow-hidden rounded-2xl border border-slate-100 bg-[#eef4f2]">
          <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden>
            <path
              d="M18 100 C 60 92, 52 58, 92 54 S 150 40, 182 16"
              fill="none"
              stroke="#009688"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="6 7"
            />
            <circle cx="18" cy="100" r="6" fill="#009688" />
            <circle cx="92" cy="54" r="6" fill="#fff" stroke="#009688" strokeWidth="3" />
            <circle cx="182" cy="16" r="6" fill="#fff" stroke="#cbd5e1" strokeWidth="3" />
          </svg>
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[0.55rem] font-semibold text-slate-600 shadow-sm">
            <Navigation className="h-2.5 w-2.5 text-accent" /> 3 of 8 stops
          </div>
        </div>

        {[
          { name: "Sharma Distributors", meta: "2.4 km · 11:05 AM", done: true },
          { name: "New Metro Traders", meta: "5.1 km · 11:30 AM", done: true },
          { name: "Anand Hardware", meta: "7.8 km · next stop", done: false },
        ].map((stop) => (
          <div
            key={stop.name}
            className="mb-2 flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                stop.done ? "bg-accent/15 text-accent" : "bg-slate-100 text-slate-400"
              }`}
            >
              {stop.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <MapPin className="h-3 w-3" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[0.66rem] font-semibold text-slate-700">{stop.name}</div>
              <div className="text-[0.55rem] text-slate-400">{stop.meta}</div>
            </div>
          </div>
        ))}
      </ScreenChrome>
    ),
  },
  {
    alt: "Offline capture and end-of-day targets",
    content: (
      <ScreenChrome title="My Day" tab="profile">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-2.5">
          <CloudOff className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <div className="text-[0.66rem] font-bold text-amber-700">Working offline</div>
            <div className="text-[0.55rem] text-amber-600">4 orders queued · sync on signal</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { label: "Visits", value: "6/8" },
            { label: "Orders", value: "₹3.2L" },
            { label: "Collected", value: "₹84K" },
            { label: "Distance", value: "41 km" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
              <div className="text-[0.55rem] text-slate-400">{stat.label}</div>
              <div className="text-[0.85rem] font-bold text-slate-800">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[0.62rem] font-semibold text-slate-700">
            <TrendingUp className="h-3 w-3 text-accent" /> Monthly target
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[72%] rounded-full bg-accent" />
          </div>
          <div className="mt-1.5 flex justify-between text-[0.55rem] text-slate-400">
            <span>₹18.0L achieved</span>
            <span>72%</span>
          </div>
        </div>
      </ScreenChrome>
    ),
  },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={appScreens} />;
}
