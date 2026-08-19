"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import Icon from "@/components/Icon";
import { platformMenu } from "@/lib/content";
import { cn } from "@/lib/utils";

const registry = platformMenu.groups.flatMap((g) => g.links);

export default function CustomPackageBuilder() {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (c: string) =>
    setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border-2 border-dashed border-accent/40 bg-card p-6 shadow-soft md:p-8">
      <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/8 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <div className="max-w-xl">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-accent">
            Custom · build your own
          </p>
          <h2 className="mt-2 font-display text-[1.4rem] font-bold leading-snug tracking-tight text-ink md:text-[1.6rem]">
            None of the eight fit exactly? Compose your own.
          </h2>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted">
            Tap the modules you actually run - we&rsquo;ll price just those, on
            the same platform, upgradeable any time.
          </p>
        </div>
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-faint">
          <span className="text-accent">{sel.length}</span> / {registry.length} selected
        </p>
      </div>

      <div className="relative mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {registry.map((m) => {
          const on = sel.includes(m.code);
          return (
            <button
              key={m.code}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(m.code)}
              title={m.desc}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150",
                on
                  ? "border-accent bg-accent/8 shadow-[0_8px_20px_-12px_rgba(0,150,136,0.5)]"
                  : "border-line bg-paper/50 hover:border-accent/40 hover:bg-paper"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  on ? "border-accent bg-accent text-white" : "border-line bg-card text-accent"
                )}
              >
                <Icon name={m.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[0.84rem] font-semibold leading-tight", on ? "text-ink" : "text-ink/80")}>
                  {m.label}
                </span>
                <span className="font-mono text-[0.58rem] font-bold uppercase tracking-wider text-faint">
                  {m.code}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                  on ? "bg-accent text-white" : "bg-paper text-faint group-hover:text-accent"
                )}
              >
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : <Plus className="h-3 w-3" strokeWidth={2.5} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line-2 pt-5">
        <p className="min-w-0 text-[0.84rem] text-muted">
          {sel.length ? (
            <>
              Your package:{" "}
              <span className="font-mono text-[0.78rem] font-bold text-accent">
                {sel.join(" + ")}
              </span>
            </>
          ) : (
            "Select at least one module to get a quote."
          )}
        </p>
        <Link
          href={`/contact?modules=${sel.join(",")}`}
          aria-disabled={sel.length === 0}
          className={cn(
            "btn-primary group inline-flex shrink-0 items-center gap-2 rounded-xl px-6 py-3 text-[0.9rem] font-semibold",
            sel.length === 0 && "pointer-events-none opacity-40"
          )}
        >
          Get custom pricing
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
