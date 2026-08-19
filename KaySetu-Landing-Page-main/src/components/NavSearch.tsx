"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import Icon from "@/components/Icon";
import { searchSite } from "@/lib/searchIndex";
import { cn } from "@/lib/utils";

export default function NavSearch({
  className,
  onNavigate,
  autoFocus = false,
  variant = "input",
}: {
  className?: string;
  /** Called after a result is picked - lets the mobile sheet close itself. */
  onNavigate?: () => void;
  autoFocus?: boolean;
  /** "icon" collapses the field to a single button that opens the field in a popover. */
  variant?: "input" | "icon";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isIcon = variant === "icon";

  const results = useMemo(() => searchSite(query), [query]);

  // Every path that changes the query resets the highlight too, so Enter can
  // never fire a stale row after the list shrinks under the cursor.
  const updateQuery = (next: string) => {
    setQuery(next);
    setCursor(0);
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // "/" focuses search from anywhere, unless the user is already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      // In icon mode the field is mounted by `expanded`, so focus waits for it.
      if (isIcon) setExpanded(true);
      else inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isIcon]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const go = (href: string) => {
    setOpen(false);
    setExpanded(false);
    updateQuery("");
    inputRef.current?.blur();
    onNavigate?.();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setExpanded(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor].href);
    }
  };

  const showPanel = (isIcon ? expanded : open) && query.trim().length >= 2;

  const field = (
    <div className="flex items-center gap-2 rounded-full border border-line bg-paper/80 px-3 py-1.5 transition-colors focus-within:border-accent/40 focus-within:bg-card">
      <Search className="h-4 w-4 shrink-0 text-faint" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          updateQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search modules, industries…"
        aria-label="Search the site"
        aria-expanded={showPanel}
        aria-controls="nav-search-results"
        role="combobox"
        aria-autocomplete="list"
        className="w-full min-w-0 bg-transparent text-[0.85rem] text-ink outline-none placeholder:text-faint"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            updateQuery("");
            inputRef.current?.focus();
          }}
          className="shrink-0 text-faint transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[0.65rem] font-medium text-faint lg:block">
          /
        </kbd>
      )}
    </div>
  );

  const resultList = results.length ? (
    <ul className="max-h-[22rem] overflow-y-auto p-1.5">
      {results.map((r, i) => (
        <li key={r.href}>
          <button
            type="button"
            role="option"
            aria-selected={i === cursor}
            onMouseEnter={() => setCursor(i)}
            onClick={() => go(r.href)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              i === cursor ? "bg-paper-2" : "hover:bg-paper",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent">
              <Icon name={r.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold text-ink">
              {r.title}
            </span>
            <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-faint">
              {r.kind}
            </span>
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <p className="px-4 py-5 text-center text-[0.85rem] text-muted">
      No matches for “{query.trim()}”.{" "}
      <a href="/contact" className="font-semibold text-accent hover:underline">
        Ask us instead
      </a>
      .
    </p>
  );

  // Icon mode: the bar shows only a button; the field itself lives in the popover.
  if (isIcon) {
    return (
      <div ref={rootRef} className={cn("relative", className)}>
        <button
          type="button"
          aria-label="Search the site"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-line transition-colors",
            expanded
              ? "border-accent/40 bg-card text-accent"
              : "bg-paper/70 text-ink/70 hover:border-accent/40 hover:bg-card hover:text-ink",
          )}
        >
          <Search className="h-4 w-4" />
        </button>

        {expanded ? (
          <div className="animate-dropdown absolute left-1/2 top-full z-50 mt-3 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-card/97 p-2 shadow-xl backdrop-blur-xl">
            {field}
            {showPanel ? (
              <div id="nav-search-results" role="listbox" className="mt-1">
                {resultList}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {field}

      {showPanel ? (
        <div
          id="nav-search-results"
          role="listbox"
          // Matches the input in the mobile sheet, but from lg - where the bar's
          // input is too narrow to show a module name without truncating - it
          // anchors right and grows past it.
          className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card/97 shadow-xl backdrop-blur-xl lg:w-[min(24rem,calc(100vw-2rem))]"
        >
          {resultList}
        </div>
      ) : null}
    </div>
  );
}
