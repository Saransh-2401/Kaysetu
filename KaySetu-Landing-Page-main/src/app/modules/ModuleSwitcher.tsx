"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { modulePages } from "@/lib/modulePages";
import Walkthrough from "@/components/Walkthrough";
import Icon from "@/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

/* The interactive switcher lets users pick one of the 11 platform modules.
   When clicked, it scrolls smoothly to the top of the module section rather
   than the hero. */
export default function ModuleSwitcher() {
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get("module");
  const paramSlug = modulePages.find((m) => m.slug === moduleParam)?.slug;

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // The module the user clicked; null means "follow ?module=".
  const [picked, setPicked] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <div
      ref={containerRef}
      id="service-section"
      className="scroll-mt-28 grid gap-12 lg:grid-cols-[300px_1fr] items-start"
    >
      {/* Sticky Sidebar Directory */}
      <aside className="sticky top-28 hidden lg:block">
        <h2 className="mb-6 text-[0.85rem] font-bold tracking-widest text-faint uppercase">
          All 11 Modules
        </h2>
        <div className="space-y-1">
          {modulePages.map((m) => {
            const isActive = activeSlug === m.slug;
            return (
              <button
                key={m.slug}
                onClick={() => handleSelectModule(m.slug)}
                className={`group flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-all duration-300 ${
                  isActive
                    ? "bg-accent text-card shadow-soft"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <span className="min-w-0 truncate font-semibold text-[0.95rem]">{m.hero.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-px font-mono text-[0.58rem] font-semibold uppercase tracking-[0.08em] ${
                      isActive
                        ? "border-white/30 text-white/90"
                        : "border-accent/25 bg-accent/8 text-accent"
                    }`}
                  >
                    {m.hero.kicker}
                  </span>
                  <Icon
                    name="ChevronRight"
                    className={`h-4 w-4 transition-transform duration-300 ${
                      isActive
                        ? "translate-x-1"
                        : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2"
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Dropdown (Visible only on small screens) */}
      <div ref={dropdownRef} className="lg:hidden mb-8 relative">
        <span className="mb-3 block text-[0.85rem] font-bold tracking-widest text-faint uppercase">
          Select Module
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-soft transition-colors duration-300 ${
            dropdownOpen ? "border-accent" : "border-line"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon name="LayoutGrid" className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.95rem] font-semibold text-ink">
                {activeModule.hero.title}
              </span>
              <span className="block font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-accent">
                {activeModule.hero.kicker}
              </span>
            </span>
          </span>
          <Icon
            name="ChevronDown"
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              role="listbox"
              aria-label="Select module"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              /* z-40, not z-30: the Walkthrough step bar is sticky z-30 and
                 later in the DOM, so at equal z it paints over the open menu. */
              className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] origin-top overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-soft"
            >
              {modulePages.map((m) => {
                const isActive = activeSlug === m.slug;
                return (
                  <button
                    key={m.slug}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setDropdownOpen(false);
                      handleSelectModule(m.slug);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left transition-colors duration-200 ${
                      isActive
                        ? "bg-accent text-card"
                        : "text-muted hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate text-[0.92rem] font-semibold">
                      {m.hero.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-px font-mono text-[0.58rem] font-semibold uppercase tracking-[0.08em] ${
                          isActive
                            ? "border-white/30 text-white/90"
                            : "border-accent/25 bg-accent/8 text-accent"
                        }`}
                      >
                        {m.hero.kicker}
                      </span>
                      {isActive && <Icon name="Check" className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
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
