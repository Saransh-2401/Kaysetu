"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { modulePages } from "@/lib/modulePages";
import Walkthrough from "@/components/Walkthrough";
import Icon from "@/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

/* The interactive switcher allows users to select service modules. When clicked,
   it scrolls smoothly to the top of the service section rather than the hero. */
export default function ModuleSwitcher() {
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get("module");
  const paramSlug = modulePages.find((m) => m.slug === moduleParam)?.slug;

  const containerRef = useRef<HTMLDivElement>(null);

  // The module the user clicked; null means "follow ?module=".
  const [picked, setPicked] = useState<string | null>(null);

  const [seenParam, setSeenParam] = useState(moduleParam);
  if (moduleParam !== seenParam) {
    setSeenParam(moduleParam);
    setPicked(null);
  }

  const activeSlug = picked ?? paramSlug ?? modulePages[0].slug;
  const activeModule =
    modulePages.find((m) => m.slug === activeSlug) || modulePages[0];

  const handleSelectModule = (slug: string) => {
    setPicked(slug);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (moduleParam) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [moduleParam]);

  return (
    <div
      ref={containerRef}
      id="service-section"
      className="scroll-mt-28 grid gap-12 lg:grid-cols-[300px_1fr] items-start"
    >
      {/* Sticky Sidebar Directory */}
      <aside className="sticky top-28 hidden lg:block">
        <h2 className="mb-6 text-[0.85rem] font-bold tracking-widest text-faint uppercase">
          Service Modules
        </h2>
        <div className="space-y-1">
          {modulePages.map((m) => {
            const isActive = activeSlug === m.slug;
            return (
              <button
                key={m.slug}
                onClick={() => handleSelectModule(m.slug)}
                className={`group flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-all duration-300 ${
                  isActive
                    ? "bg-accent text-card shadow-soft"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <span className="font-semibold text-[0.95rem]">{m.hero.title}</span>
                <Icon
                  name="ChevronRight"
                  className={`h-4 w-4 transition-transform duration-300 ${
                    isActive
                      ? "translate-x-1"
                      : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Dropdown (Visible only on small screens) */}
      <div className="lg:hidden mb-8">
        <label
          htmlFor="module-select"
          className="mb-3 block text-[0.85rem] font-bold tracking-widest text-faint uppercase"
        >
          Select Module
        </label>
        <select
          id="module-select"
          value={activeSlug}
          onChange={(e) => handleSelectModule(e.target.value)}
          className="w-full rounded-lg border border-line bg-card px-4 py-3 text-[1rem] font-semibold text-ink shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {modulePages.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.hero.title}
            </option>
          ))}
        </select>
      </div>

      {/* Content Area with Crossfade Transition */}
      <div className="min-h-[800px] rounded-2xl bg-card border border-line shadow-soft overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Walkthrough
              data={activeModule.walkthrough}
              className="px-6 py-12 md:px-12 md:py-16"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
