import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/PageChrome";
import { Reveal } from "@/components/Motion";
import { industryPages, industryBySlug, type IndustryPage } from "@/lib/content";

const BASE = "https://kaysetu.kayease.com";

function renderTopIcon(index: number, isDark: boolean) {
  const colorClass = isDark ? "text-teal-400" : "text-accent";
  switch (index % 6) {
    case 0:
      // Barcode Scan Frame
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="8" y1="8" x2="8" y2="16" strokeWidth="2" />
          <line x1="11" y1="8" x2="11" y2="16" strokeWidth="1" />
          <line x1="13" y1="8" x2="13" y2="16" strokeWidth="2.5" />
          <line x1="16" y1="8" x2="16" y2="16" strokeWidth="1.5" />
        </svg>
      );
    case 1:
      // Calculator %
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <circle cx="9" cy="12" r="1" fill="currentColor" />
          <circle cx="15" cy="16" r="1" fill="currentColor" />
          <line x1="15" y1="11" x2="9" y2="17" strokeWidth="1.5" />
        </svg>
      );
    case 2:
      // Storefront
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l2-5h14l2 5" />
          <path d="M3 9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
          <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
          <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
        </svg>
      );
    case 3:
      // Sync Refresh Arrows
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21.5 2v6h-6" />
          <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      );
    case 4:
      // Mobile + Box
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="9" height="17" rx="2" />
          <path d="M15 13l4-2v5l-4 2v-5z" />
          <path d="M19 11l-4-2 4-2 4 2-4 2z" />
        </svg>
      );
    case 5:
    default:
      // Invoice with Currency Symbol
      return (
        <svg className={`h-8 w-8 ${colorClass} stroke-[1.6]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M12 18v-4m-2 1h3.5a1.5 1.5 0 0 0 0-3H10" />
        </svg>
      );
  }
}

function renderBottomGraphic(index: number, isDark: boolean) {
  const opacityClass = isDark ? "opacity-30" : "opacity-25";
  const bgClass = isDark ? "bg-teal-400" : "bg-accent";

  switch (index % 6) {
    case 0:
      // Barcode vertical lines
      return (
        <div className={`flex items-end gap-1 ${opacityClass}`} aria-hidden="true">
          <span className={`h-7 w-1 ${bgClass} rounded-full`} />
          <span className={`h-5 w-0.5 ${bgClass} rounded-full`} />
          <span className={`h-7 w-1.5 ${bgClass} rounded-full`} />
          <span className={`h-4 w-0.5 ${bgClass} rounded-full`} />
          <span className={`h-7 w-1 ${bgClass} rounded-full`} />
          <span className={`h-5 w-1.5 ${bgClass} rounded-full`} />
          <span className={`h-7 w-0.5 ${bgClass} rounded-full`} />
        </div>
      );
    case 1:
    case 4:
      // 3x3 Grid pattern
      return (
        <div className={`grid grid-cols-3 gap-1 ${opacityClass}`} aria-hidden="true">
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass} opacity-40`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
          <span className={`h-2 w-2 rounded-[2px] ${bgClass}`} />
        </div>
      );
    case 2:
    case 3:
      // Ascending bar chart
      return (
        <div className={`flex items-end gap-1 ${opacityClass}`} aria-hidden="true">
          <span className={`h-3 w-1.5 ${bgClass} rounded-sm`} />
          <span className={`h-4.5 w-1.5 ${bgClass} rounded-sm`} />
          <span className={`h-6 w-1.5 ${bgClass} rounded-sm`} />
          <span className={`h-8 w-1.5 ${bgClass} rounded-sm`} />
        </div>
      );
    case 5:
    default:
      // 4 bulleted list lines
      return (
        <div className={`flex w-7 flex-col gap-1.5 ${opacityClass}`} aria-hidden="true">
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${bgClass}`} />
            <span className={`h-1 flex-1 rounded-full ${bgClass}`} />
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${bgClass}`} />
            <span className={`h-1 flex-1 rounded-full ${bgClass}`} />
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${bgClass}`} />
            <span className={`h-1 flex-1 rounded-full ${bgClass}`} />
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${bgClass}`} />
            <span className={`h-1 flex-1 rounded-full ${bgClass}`} />
          </div>
        </div>
      );
  }
}

function getStepDetail(step: { label: string; detail?: string }, index: number) {
  if (step.detail) return step.detail;
  const l = step.label.toLowerCase();
  if (l.includes("style") || l.includes("beat") || l.includes("visit") || l.includes("scan") || l.includes("plan")) return "Size + colour";
  if (l.includes("order") || l.includes("production") || l.includes("job") || l.includes("field")) return "Work order";
  if (l.includes("stock") || l.includes("matrix") || l.includes("dealer") || l.includes("allocat") || l.includes("retail")) return "Live quantity";
  if (l.includes("pack") || l.includes("pick") || l.includes("dispatch") || l.includes("ship")) return "Ready to ship";
  if (l.includes("transit") || l.includes("log") || l.includes("deliver") || l.includes("liquid")) return "In transit";
  if (l.includes("invoice") || l.includes("bill") || l.includes("gst") || l.includes("tax")) return "Tax ready";
  const defaults = ["Size + colour", "Work order", "Live quantity", "Ready to ship", "In transit", "Tax ready"];
  return defaults[index % defaults.length];
}

function IndustrySignatureGraphic({ slug }: { slug: string }) {
  switch (slug) {
    case "textiles":
      return (
        <div className="my-5 rounded-xl border border-line/70 bg-paper/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-3.5 w-3.5 rounded-full bg-indigo-900" />
            <span className="h-3.5 w-3.5 rounded-full bg-accent" />
            <span className="h-3.5 w-3.5 rounded-full bg-purple-600" />
            <span className="h-3.5 w-3.5 rounded-full bg-amber-600" />
            <span className="h-3.5 w-3.5 rounded-full bg-rose-500" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1.5">
              <div className="h-5 rounded-md bg-indigo-900" />
              <div className="h-5 rounded-md bg-indigo-700/60" />
              <div className="h-5 rounded-md bg-indigo-500/40" />
              <div className="h-5 rounded-md bg-indigo-300/30" />
            </div>
            <div className="space-y-1.5">
              <div className="h-5 rounded-md bg-accent" />
              <div className="h-5 rounded-md bg-accent/60" />
              <div className="h-5 rounded-md bg-accent/40" />
              <div className="h-5 rounded-md bg-accent/25" />
            </div>
            <div className="space-y-1.5">
              <div className="h-5 rounded-md bg-purple-600" />
              <div className="h-5 rounded-md bg-purple-500/60" />
              <div className="h-5 rounded-md bg-purple-400/40" />
              <div className="h-5 rounded-md bg-purple-300/30" />
            </div>
            <div className="space-y-1.5">
              <div className="h-5 rounded-md bg-amber-600" />
              <div className="h-5 rounded-md bg-amber-500/60" />
              <div className="h-5 rounded-md bg-amber-400/40" />
              <div className="h-5 rounded-md bg-amber-300/30" />
            </div>
            <div className="space-y-1.5">
              <div className="h-5 rounded-md bg-rose-500" />
              <div className="h-5 rounded-md bg-rose-400/60" />
              <div className="h-5 rounded-md bg-rose-300/40" />
              <div className="h-5 rounded-md bg-rose-200/30" />
            </div>
          </div>
        </div>
      );

    case "electronics":
      return (
        <div className="my-5 rounded-xl border border-line/70 bg-paper/50 p-4 space-y-2.5 font-mono text-[0.74rem]">
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line shadow-soft">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" />
              <span className="font-semibold text-ink">SN-88239014</span>
            </div>
            <span className="text-accent font-bold">SCAN OK</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line opacity-85">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" />
              <span className="font-semibold text-ink">IMEI-35891024</span>
            </div>
            <span className="text-muted">DISPATCHED</span>
          </div>
        </div>
      );

    case "pharma":
      return (
        <div className="my-5 rounded-xl border border-line/70 bg-paper/50 p-4 space-y-2.5 font-mono text-[0.74rem]">
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line">
            <span className="text-ink font-semibold">BATCH #B-2026-09</span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">FEFO PASS</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line opacity-85">
            <span className="text-muted">EXPIRY ALERT</span>
            <span className="text-amber-600 font-semibold">180 DAYS REMAINING</span>
          </div>
        </div>
      );

    default:
      return (
        <div className="my-5 rounded-xl border border-line/70 bg-paper/50 p-4 space-y-2.5 font-mono text-[0.74rem]">
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line">
            <span className="text-ink font-semibold">LIVE CONNECTED LEDGER</span>
            <span className="text-accent font-bold">REAL-TIME</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-line opacity-85">
            <span className="text-muted">ORDER TO BILL</span>
            <span className="text-ink font-semibold">ZERO DOUBLE ENTRY</span>
          </div>
        </div>
      );
  }
}

// Only the nine known industries render; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return industryPages.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) return {};
  const url = `/industries/${ind.slug}`;
  return {
    title: { absolute: ind.seo.title },
    description: ind.seo.description,
    keywords: ind.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: ind.seo.title,
      description: ind.seo.description,
      type: "website",
      images: ["/opengraph-image"],
      url,
      siteName: "KaySetu",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: ind.seo.title,
      description: ind.seo.description,
    },
  };
}

/* ── Signature hero panel — a live "workflow snapshot" for the vertical ── */
function HeroPanel({ ind }: { ind: IndustryPage }) {
  return (
    <Reveal className="relative" delay={140}>
      {/* Radial aura + drifting ghost backdrop icon */}
      <div className="absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(60%_60%_at_75%_25%,rgba(0,150,136,0.22),transparent_75%)] aura-pulse" />
      <span className="pointer-events-none absolute -right-8 -top-12 -z-10 text-accent/[0.05] ghost-drift">
        <Icon name={ind.icon} className="h-60 w-60" strokeWidth={1} />
      </span>

      {/* Floating Glassmorphic Top Badge */}
      <div className="absolute -top-4 -right-4 z-20 hidden sm:flex items-center gap-2 rounded-full border border-accent/30 bg-card/90 backdrop-blur px-3.5 py-1.5 shadow-float font-mono text-[0.7rem] font-bold text-accent">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        LIVE ENTERPRISE ENGINE
      </div>

      {/* Main Glassmorphic Card Container */}
      <div className="shadow-[0_25px_60px_-15px_rgba(16,35,75,0.12)] overflow-hidden rounded-[26px] border border-line bg-card/95 backdrop-blur">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-line bg-paper/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 font-mono text-[0.66rem] font-semibold text-muted shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
            <span className="text-ink">{ind.name} Workspace</span>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {/* Stat Tiles Row */}
          <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3.5">
            {ind.hero.stats.map((s, idx) => (
              <div
                key={s.label}
                className="group relative flex flex-col justify-between rounded-2xl border border-line/80 bg-gradient-to-b from-paper/60 to-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:bg-card hover:shadow-soft"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-accent/20 via-accent to-accent/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.64rem] font-semibold text-faint uppercase">
                    0{idx + 1}
                  </span>
                  <span className="font-mono text-[0.62rem] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                    LIVE
                  </span>
                </div>
                <div className="mt-2 min-w-0 break-words font-display text-[1.15rem] sm:text-[1.35rem] font-bold leading-tight text-ink transition-transform duration-300 group-hover:scale-105 group-hover:text-accent-ink">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[0.7rem] font-medium leading-tight text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Compact Connected Workflow Pipeline */}
          <div className="mt-6 pt-5 border-t border-line/70">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[0.66rem] font-bold uppercase tracking-wider text-faint">
                Live Operation Pipeline
              </span>
              <span className="font-mono text-[0.64rem] font-semibold text-accent flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected End-to-End
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 bg-paper/40 p-3 rounded-2xl border border-line/60">
              {ind.workflow.steps.map((step, i) => (
                <div key={step.label} className="flex items-center flex-1 justify-center">
                  <div className="group relative flex flex-col items-center">
                    <span
                      className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-115 ${
                        i === 0
                          ? "border-accent bg-accent text-white shadow-[0_4px_12px_rgba(0,150,136,0.35)]"
                          : "border-line bg-card text-accent group-hover:border-accent group-hover:bg-accent group-hover:text-white"
                      }`}
                    >
                      <Icon name={step.icon} className="h-4.5 w-4.5 stroke-[1.6]" />
                    </span>
                  </div>
                  {i < ind.workflow.steps.length - 1 && (
                    <span className="mx-0.5 h-0.5 flex-1 bg-line/80 group-hover:bg-accent/40" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Glassmorphic Card */}
      <div className="absolute -bottom-4 -left-4 z-20 hidden sm:flex items-center gap-3 rounded-2xl border border-line bg-card/90 backdrop-blur p-3 px-4 shadow-float">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold">
          ✓
        </div>
        <div className="font-sans">
          <div className="text-[0.76rem] font-bold text-ink">100% Audit & GST Ready</div>
          <div className="text-[0.66rem] font-medium text-muted">Zero double entries</div>
        </div>
      </div>
    </Reveal>
  );
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) notFound();

  const others = industryPages.filter((i) => i.slug !== ind.slug);
  const [featCap, ...restCaps] = ind.capabilities.cards;

  // Per-page structured data: FAQ rich results + breadcrumb trail.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE },
          { "@type": "ListItem", position: 2, name: "Industries", item: `${BASE}/industries` },
          { "@type": "ListItem", position: 3, name: ind.name, item: `${BASE}/industries/${ind.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: ind.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-line bg-gradient-to-b from-paper/40 via-card/30 to-paper/50">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-25" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
        
        <div className="relative mx-auto grid max-w-[1600px] gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <Reveal className="min-w-0">
            <nav className="mb-6 flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-wider text-faint">
              <Link href="/" className="transition-colors hover:text-accent">Home</Link>
              <span>/</span>
              <Link href="/industries" className="transition-colors hover:text-accent">Industries</Link>
              <span>/</span>
              <span className="text-accent font-semibold">{ind.name}</span>
            </nav>

            <h1 className="font-display text-[2.4rem] sm:text-[3.2rem] lg:text-[3.8rem] font-bold leading-[1.03] tracking-tight balance text-ink">
              <Amp text={ind.hero.title} />{" "}
              <span className="bg-gradient-to-r from-accent via-accent-soft to-accent-ink bg-clip-text text-transparent">
                <Amp text={ind.hero.titleAccent} />
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
              {ind.hero.subhead}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/contact"
                className="btn-primary group inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-[0.98rem] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_12px_32px_-6px_rgba(0,150,136,0.45)]"
              >
                Book a Free Demo
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/packages"
                className="group inline-flex items-center gap-2 rounded-xl border border-line bg-card/90 backdrop-blur px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent hover:shadow-float"
              >
                Explore the packages
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Micro Trust Bar */}
            <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-line/60 pt-6 font-mono text-[0.72rem] font-semibold text-muted">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                <span>100% Real-Time Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                <span>GST & E-Way Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                <span>Zero Double Entry</span>
              </div>
            </div>
          </Reveal>

          <HeroPanel ind={ind} />
        </div>
      </header>

      {/* ── Challenges — the "cold" cost ledger (desaturated on purpose) ── */}
      {/* ── Challenges — The Operational Gap (Bento Layout) ── */}
      <section className="border-b border-line bg-paper/40 py-20 md:py-24">
        <div className="mx-auto max-w-[1600px] px-5">
          {/* Header row with kicker, title & intro */}
          <Reveal className="max-w-3xl">
            <span className="font-mono text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-accent">
              The Operational Gap
            </span>
            <h2 className="mt-3 font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight balance text-ink md:text-[2.9rem]">
              <Amp text={ind.challenges.title} />
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
              {ind.challenges.intro}
            </p>
          </Reveal>

          {/* 3x2 Grid Cards */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {ind.challenges.items.map((it, i) => {
              const isFeaturedDark = i === 3;
              return (
                <Reveal
                  key={it.pain}
                  delay={(i % 3) * 70}
                  className={`group relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-[20px] p-4 sm:p-7 transition-all duration-300 hover:-translate-y-1 ${
                    isFeaturedDark
                      ? "bg-[#0b1938] text-white shadow-float border border-[#0b1938] hover:shadow-2xl hover:border-teal-400/40"
                      : "bg-card text-ink shadow-soft border border-line/80 hover:border-accent/40 hover:shadow-float"
                  }`}
                >
                  <div>
                    {/* Top Row: Index Number + Top Right Icon */}
                    <div className="flex items-start justify-between">
                      <span
                        className={`font-mono text-xl font-bold tracking-tight ${
                          isFeaturedDark ? "text-teal-400" : "text-accent"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="shrink-0">{renderTopIcon(i, isFeaturedDark)}</div>
                    </div>

                    {/* Pain Heading */}
                    <h3
                      className={`mt-4 font-sans text-[0.92rem] sm:text-[1.12rem] font-bold leading-snug ${
                        isFeaturedDark ? "text-white" : "text-ink group-hover:text-accent-ink"
                      }`}
                    >
                      {it.pain}
                    </h3>

                    {/* Short Horizontal Line Accent */}
                    <div
                      className={`mt-3.5 mb-4 w-14 border-b-2 ${
                        isFeaturedDark ? "border-white/15" : "border-line"
                      }`}
                    />

                    {/* Impact Text */}
                    <p
                      className={`text-[0.78rem] sm:text-[0.88rem] leading-relaxed ${
                        isFeaturedDark ? "text-slate-300" : "text-muted"
                      }`}
                    >
                      {it.impact}
                    </p>
                  </div>

                  {/* Bottom Row: Arrow on left, Graphic Pattern on right */}
                  <div className="mt-6 flex items-end justify-between">
                    <ArrowRight
                      className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5 ${
                        isFeaturedDark ? "text-teal-400" : "text-accent"
                      }`}
                      strokeWidth={2}
                    />
                    <div className="shrink-0">{renderBottomGraphic(i, isFeaturedDark)}</div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Capabilities — Vertical Stepper Backbone Timeline ── */}
      <section className="border-b border-line bg-paper/30 py-20 md:py-28">
        <div className="mx-auto max-w-[1600px] px-5">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] xl:grid-cols-[0.9fr_1.1fr] lg:items-start">
            {/* Left Column: Title, Lead & Signature Capability Card */}
            <Reveal className="flex flex-col gap-6">
              <div>
                <span className="font-mono text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-accent block mb-3">
                  System Capabilities
                </span>
                <h2 className="font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight balance text-ink md:text-[2.9rem]">
                  <Amp text={ind.capabilities.title} />
                </h2>
                <p className="mt-4 text-[1.05rem] leading-relaxed text-muted max-w-xl">
                  {ind.capabilities.lead}
                </p>
              </div>

              {/* Signature Card */}
              <div className="group relative flex flex-col justify-between rounded-[24px] border border-line bg-card p-7 shadow-soft transition-all duration-300 hover:border-accent/40 hover:shadow-float mt-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white shadow-soft transition-transform duration-300 group-hover:scale-110">
                      <Icon name={featCap.icon} className="h-6 w-6" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[0.66rem] font-semibold uppercase tracking-wider text-accent">
                      Signature Capability
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-2xl font-bold leading-tight text-ink transition-colors duration-300 group-hover:text-accent">
                    <Amp text={featCap.name} />
                  </h3>
                  <p className="mt-3 text-[0.94rem] leading-relaxed text-muted">
                    {featCap.desc}
                  </p>

                  {/* Tailored Visual Graphic Mockup */}
                  <IndustrySignatureGraphic slug={ind.slug} />
                </div>

                <div className="mt-4 flex items-center gap-2 pt-3 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-faint border-t border-line/60">
                  <Check className="h-4 w-4 text-accent" strokeWidth={2.4} />
                  One connected system
                </div>
              </div>
            </Reveal>

            {/* Right Column: 5 Capability Cards with Vertical Stepper Backbone Line */}
            <div className="relative pl-0 xl:pl-10">
              {/* Vertical Stepper Spine Line (Desktop) */}
              <div
                aria-hidden="true"
                className="hidden xl:block absolute left-[1.1rem] top-7 bottom-7 w-0.5 bg-line/80"
              />

              <div className="flex flex-col gap-4.5">
                {restCaps.map((c, i) => {
                  const isLast = i === restCaps.length - 1;
                  return (
                    <Reveal
                      key={c.name}
                      delay={i * 70}
                      className="relative flex items-center gap-4 group"
                    >
                      {/* Numbered Stepper Spine Badge (Desktop) */}
                      <div className="hidden xl:flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card font-mono text-xs font-bold text-accent shadow-soft z-10 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                        0{i + 1}
                      </div>

                      {/* Capability Card */}
                      <div
                        className={`group/card relative flex flex-1 items-center justify-between rounded-[20px] border border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float ${
                          isLast
                            ? "bg-paper/70 border-accent/25 hover:bg-card"
                            : "bg-card shadow-soft"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accent transition-all duration-300 group-hover/card:border-accent group-hover/card:bg-accent group-hover/card:text-white group-hover/card:scale-110">
                            <Icon name={c.icon} className="h-5.5 w-5.5" />
                          </span>
                          <div>
                            <h3 className="font-display text-[1.08rem] font-bold text-ink transition-colors duration-300 group-hover/card:text-accent-ink">
                              <Amp text={c.name} />
                            </h3>
                            <p className="mt-1 text-[0.88rem] leading-relaxed text-muted">
                              {c.desc}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="h-4 w-4 shrink-0 text-accent transition-transform duration-300 group-hover/card:translate-x-1 ml-3" strokeWidth={2} />
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow — Connected Roadmap Pipeline ──── */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-paper/30 via-card/40 to-paper/30 py-20 md:py-28">
        {/* Background decorative watermark graphics */}
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 text-accent/10 opacity-40 hidden xl:block">
          <svg className="h-96 w-96" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.8">
            <path d="M 30 30 Q 120 40, 100 120 T 180 180" strokeDasharray="4 4" />
            <rect x="120" y="30" width="55" height="75" rx="8" transform="rotate(12 147 67)" />
            <circle cx="150" cy="45" r="5" />
          </svg>
        </span>

        <div className="mx-auto max-w-[1600px] px-5">
          <Reveal className="max-w-3xl">
            <h2 className="font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight balance text-ink md:text-[3rem]">
              <Amp text={ind.workflow.title} />
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
              {ind.workflow.lead}
            </p>
          </Reveal>

          <div className="relative mt-16 lg:mt-24">
            {/* Winding Serpentine Roadmap Track (Desktop SVG with live motion) */}
            <svg
              className="hidden lg:block absolute inset-0 pointer-events-none w-full h-full"
              viewBox="0 0 1200 360"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* Soft ambient glow road band */}
              <path
                d="M 60 210 C 160 210, 180 275, 270 275 C 370 275, 390 125, 480 125 C 580 125, 600 275, 690 275 C 790 275, 810 125, 900 125 C 1000 125, 1020 210, 1140 210"
                fill="none"
                stroke="#009688"
                strokeWidth="16"
                strokeOpacity="0.09"
              />
              {/* Flowing animated dash lines */}
              <path
                d="M 60 210 C 160 210, 180 275, 270 275 C 370 275, 390 125, 480 125 C 580 125, 600 275, 690 275 C 790 275, 810 125, 900 125 C 1000 125, 1020 210, 1140 210"
                fill="none"
                stroke="#009688"
                strokeWidth="3"
                strokeDasharray="10 7"
                strokeOpacity="0.5"
                className="animate-dash-flow"
              />
              <path
                d="M 60 210 C 160 210, 180 275, 270 275 C 370 275, 390 125, 480 125 C 580 125, 600 275, 690 275 C 790 275, 810 125, 900 125 C 1000 125, 1020 210, 1140 210"
                fill="none"
                stroke="#26a69a"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                strokeOpacity="0.3"
              />

              {/* Traveling Light Pulse Orbs along the road */}
              <circle r="4" fill="#009688">
                <animateMotion
                  path="M 60 210 C 160 210, 180 275, 270 275 C 370 275, 390 125, 480 125 C 580 125, 600 275, 690 275 C 790 275, 810 125, 900 125 C 1000 125, 1020 210, 1140 210"
                  dur="7s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="7" fill="#26a69a" opacity="0.4">
                <animateMotion
                  path="M 60 210 C 160 210, 180 275, 270 275 C 370 275, 390 125, 480 125 C 580 125, 600 275, 690 275 C 790 275, 810 125, 900 125 C 1000 125, 1020 210, 1140 210"
                  dur="7s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Target Node Circles for 6 Steps */}
              <line x1="100" y1="175" x2="100" y2="235" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="100" cy="235" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />

              <line x1="300" y1="225" x2="300" y2="165" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="300" cy="165" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />

              <line x1="500" y1="175" x2="500" y2="235" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="500" cy="235" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />

              <line x1="700" y1="225" x2="700" y2="165" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="700" cy="165" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />

              <line x1="900" y1="175" x2="900" y2="235" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="900" cy="235" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />

              <line x1="1100" y1="225" x2="1100" y2="165" stroke="#009688" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.4" />
              <circle cx="1100" cy="165" r="5.5" fill="#ffffff" stroke="#009688" strokeWidth="2.5" />
            </svg>

            {/* 6 Step Cards Grid */}
            <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5 items-center justify-items-center">
              {ind.workflow.steps.map((step, i) => {
                const isEven = i % 2 === 0;
                const detail = getStepDetail(step, i);
                return (
                  <Reveal
                    key={step.label}
                    delay={i * 80}
                    className={`group relative flex flex-col items-center justify-between rounded-[18px] border border-line bg-card p-3.5 pt-6 pb-4 sm:p-4 sm:pt-7 text-center shadow-soft transition-all duration-500 ease-out hover:-translate-y-3 hover:border-accent/60 hover:shadow-[0_16px_36px_-8px_rgba(0,150,136,0.28)] w-full max-w-[145px] sm:max-w-[160px] lg:max-w-[168px] ${
                      isEven ? "lg:mt-24 lg:mb-4" : "lg:-mt-16 lg:mb-12"
                    }`}
                  >
                    {/* Gradient top border reveal on hover */}
                    <span className="absolute inset-x-0 top-0 h-1 rounded-t-[18px] bg-gradient-to-r from-accent/20 via-accent to-accent/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Radial aura background on hover */}
                    <span className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_50%_0%,rgba(0,150,136,0.08),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Top Step Number Badge */}
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-[0.68rem] font-bold text-white shadow-soft border-2 border-white transition-all duration-300 group-hover:scale-125 group-hover:bg-accent-ink group-hover:shadow-[0_0_12px_rgba(0,150,136,0.6)]">
                      {i + 1}
                    </span>

                    {/* Step Icon with Aura Ring */}
                    <div className="relative my-1.5 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-line/60 bg-paper/60 text-accent transition-all duration-300 group-hover:scale-110 group-hover:border-accent/40 group-hover:bg-accent/12 group-hover:text-accent-ink group-hover:shadow-[0_4px_14px_rgba(0,150,136,0.22)]">
                      <Icon name={step.icon} className="h-6 w-6 sm:h-7 sm:w-7 stroke-[1.5] transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    {/* Step Label */}
                    <h3 className="font-sans text-[0.82rem] sm:text-[0.88rem] font-bold leading-tight text-ink transition-colors duration-300 group-hover:text-accent-ink">
                      {step.label}
                    </h3>

                    {/* Subtitle Detail Bullet with Pinging Live Dot */}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 font-sans text-[0.7rem] sm:text-[0.74rem] font-medium text-muted transition-colors duration-300 group-hover:text-ink">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                      </span>
                      <span>{detail}</span>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal className="lg:sticky lg:top-32 lg:self-start max-w-md">
              <h2 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight balance md:text-[2.4rem]">
                <Amp text={ind.name} /> questions, answered.
              </h2>
              <p className="mt-5 text-[1.02rem] leading-relaxed text-muted">
                Everything teams ask before a demo.
              </p>

              {/* Talk to us CTA */}
              <div className="mt-8 relative overflow-hidden rounded-2xl bg-[#0b111a] p-6 flex flex-col gap-5 border border-[#1e2a3a] shadow-xl">
                <div
                  className="absolute left-0 top-0 w-full h-full opacity-[0.12] pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18202b] border border-[#232d3b]">
                    <svg className="h-5 w-5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-[1.05rem] font-bold text-white tracking-tight">Still have questions?</h3>
                    <p className="mt-1 text-[0.85rem] leading-relaxed text-[#8e9bae]">
                      Our support team is ready to help you.
                    </p>
                  </div>
                </div>
                <Link
                  href="/contact"
                  className="relative z-10 group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#232d3b] bg-[#141b26] px-4 py-2.5 text-[0.9rem] font-semibold text-[#3b82f6] transition hover:bg-[#1a2230]"
                >
                  Talk to us
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>

            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {ind.faqs.map((f, i) => (
                <Reveal key={f.q} delay={i * 60}>
                  <details open={i === 0} className="group px-6 py-5 transition-colors hover:bg-paper/40">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-[1rem] font-semibold text-ink transition-colors group-open:text-accent">
                      {f.q}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-accent transition-transform duration-200 group-open:rotate-45 group-open:border-accent">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-[0.94rem] leading-relaxed text-muted">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

    </PageShell>
  );
}
