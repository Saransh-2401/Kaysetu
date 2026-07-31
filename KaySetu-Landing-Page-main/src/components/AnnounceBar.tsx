"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { announce } from "@/lib/content";

export default function AnnounceBar() {
  const [show, setShow] = useState(true);
  if (!show) return null;

  return (
    <div className="relative z-[60] bg-ink text-card">
      <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-2 sm:gap-2.5 py-2 pl-3 pr-9 sm:py-2.5 sm:pl-10 sm:pr-11 text-center text-[0.7rem] sm:text-[0.8rem]">
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white">
          New
        </span>
        {/* The headline is the first thing to give up room; the CTA never wraps. */}
        <span className="min-w-0 truncate text-card/85">{announce.text}</span>
        <a
          href={announce.href}
          className="group hidden shrink-0 items-center gap-1 font-semibold text-accent-soft transition-colors hover:text-white xs:inline-flex"
        >
          {announce.linkLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
        <button
          aria-label="Dismiss"
          onClick={() => setShow(false)}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-card/50 transition-colors hover:text-card sm:right-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
