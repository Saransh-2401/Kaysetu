"use client";

import { useEffect, useState, useRef, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import Icon from "@/components/Icon";
import NavSearch from "@/components/NavSearch";
import AuthModal, { type AuthMode } from "@/components/AuthModal";
import { nav, brand, platformMenu, industriesMenu, industries } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/useScrollLock";

function Logo() {
  return (
    <Link 
      href="/" 
      onClick={(e) => {
        if (window.location.pathname === '/') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
      className="flex items-center transition-opacity hover:opacity-80"
    >
      <img
        src="/logo2.png"
        alt={brand.name}
        className="h-8 md:h-10 w-auto object-contain"
      />
    </Link>
  );
}

function FeatureStrip({
  kicker,
  title,
  text,
  cta,
  href,
}: {
  kicker: string;
  title: string;
  text: string;
  cta: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group/feat relative flex items-center justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-r from-espresso via-ink to-espresso px-7 py-5 text-card ring-1 ring-inset ring-white/10 transition-shadow duration-300 hover:shadow-[0_24px_50px_-26px_rgba(0,150,136,0.55)]"
    >
      {/* soft teal glow + fine hairline grid */}
      <span className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-accent/25 blur-3xl transition-all duration-500 group-hover/feat:scale-125 group-hover/feat:opacity-90" />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(255,255,255,0.07),transparent_55%)]" />
      <span className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(90deg,#000,transparent_75%)]" />

      <div className="relative flex min-w-0 items-center gap-6">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-snug">{title}</p>
          <p className="mt-0.5 truncate text-[0.82rem] leading-relaxed text-card/60">{text}</p>
        </div>
      </div>

      <span className="relative inline-flex shrink-0 items-center gap-2 rounded-full bg-accent/15 py-2 pl-4 pr-2 text-[0.82rem] font-semibold text-accent-soft transition-colors duration-200 group-hover/feat:bg-accent/25">
        {cta}
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/25 transition-transform duration-200 group-hover/feat:translate-x-0.5">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </a>
  );
}

function MenuTile({ icon, label, href, onClick }: { icon: string; label: string; href: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="group/tile flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_16px_32px_-20px_rgba(16,35,75,0.45)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-all duration-200 group-hover/tile:border-accent group-hover/tile:bg-accent group-hover/tile:text-white group-hover/tile:shadow-[0_8px_18px_-8px_rgba(0,150,136,0.6)]">
        <Icon name={icon} className="h-[1.15rem] w-[1.15rem]" />
      </span>
      <span className="flex-1 text-[0.88rem] font-semibold leading-tight text-ink transition-colors duration-200 group-hover/tile:text-accent">
        {label}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-accent opacity-0 transition-all duration-200 group-hover/tile:translate-x-0 group-hover/tile:opacity-100" />
    </a>
  );
}

function MobileSubLink({ icon, label, href, onClick }: { icon: string; label: string; href: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[0.88rem] font-medium text-ink/85 transition-colors active:bg-paper"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
    </a>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<null | "platform" | "industries">(null);
  const [menu, setMenu] = useState<null | "platform" | "industries">(null);
  const [scrolled, setScrolled] = useState(false);
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openAuth = (mode: AuthMode) => {
    setOpen(false);
    setMenu(null);
    setAuth(mode);
  };

  const handleMouseEnter = (menuItem?: "platform" | "industries" | null) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (menuItem !== undefined) setMenu(menuItem);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setMenu(null);
    }, 150);
  };

  // Anything that isn't a dropdown trigger (logo, CTAs, the empty space
  // between them) closes the flyout the moment the cursor reaches it.
  const closeMenu = () => handleMouseEnter(null);

  // Entering the bar itself closes the flyout — unless the cursor landed
  // straight on a Services/Industries trigger, which owns the open state.
  const handleBarEnter = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest?.("[data-nav-trigger]")) return;
    closeMenu();
  };

  // While a menu is down, the page underneath stays put. The bar itself can't
  // reflow either — `scrollbar-gutter: stable` keeps the gutter reserved, so
  // the triggers don't slide under a stationary cursor and re-fire the hover.
  useScrollLock(menu !== null || open);

  // Collapsing the sheet also collapses whichever accordion was open, so it
  // reopens in the same state the desktop bar starts in.
  useEffect(() => {
    if (!open) setSection(null);
  }, [open]);

  // Hysteresis: condense past 28px, expand again only below 6px. A single
  // threshold meant a few pixels of trackpad wobble flipped the whole bar back
  // and forth mid-transition, which reads as jitter rather than motion.
  useEffect(() => {
    const onScroll = () => setScrolled((s) => window.scrollY > (s ? 6 : 28));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        // Named properties, not `transition-all` — the shorthand also tried to
        // tween backdrop-filter, which can't interpolate from `none` and so
        // snapped in a frame ahead of everything else.
        "transition-[padding] duration-500 ease-nav motion-reduce:transition-none",
        scrolled ? "px-2 pt-2" : "px-0 pt-0"
      )}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onMouseEnter={handleBarEnter}
        className={cn(
          // Three tracks so the centre nav stays centred on the viewport
          // regardless of how wide the logo or the CTAs happen to be.
          "relative mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-4",
          "transition-[max-width,padding,border-radius] duration-500 ease-nav motion-reduce:transition-none",
          // Width tracks scroll only. If the open menu also resized the bar,
          // the logo/nav would slide under a stationary cursor and re-trigger
          // the hover — an open/close oscillation.
          scrolled ? "max-w-5xl rounded-full px-5 py-2.5" : "max-w-full rounded-none px-5 py-3.5 lg:px-10"
        )}
      >
        {/* The chrome is its own layer so it can cross-fade. Toggling the blur
            and shadow on the bar itself made them appear instantly, before the
            bar had finished narrowing. `-z-10` keeps it behind the contents;
            the header's own z-50 stacking context stops it falling further. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-card/90 shadow-md backdrop-blur-xl",
            "transition-opacity duration-500 ease-nav motion-reduce:transition-none",
            scrolled || menu ? "opacity-100" : "opacity-0"
          )}
        />
        <span onMouseEnter={closeMenu} className="flex items-center">
          <Logo />
        </span>

        {/* desktop nav — centred, search sits at its tail */}
        <nav className="hidden items-center justify-center gap-1 lg:flex" onMouseLeave={handleMouseLeave}>
          {nav.primary.map((item) =>
            "menu" in item && item.menu ? (
              <button
                key={item.label}
                data-nav-trigger
                onMouseEnter={() => handleMouseEnter(item.menu!)}
                onClick={() => setMenu((m) => (m === item.menu ? null : item.menu!))}
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-[0.9rem] font-medium transition-colors ${
                  menu === item.menu ? "text-accent" : "text-ink/75 hover:text-ink"
                }`}
              >
                {item.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${menu === item.menu ? "rotate-180" : ""}`}
                />
              </button>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onMouseEnter={() => handleMouseEnter(null)}
                className="rounded-md px-3 py-2 text-[0.9rem] font-medium text-ink/75 transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            )
          )}

          <span onMouseEnter={closeMenu} className="ml-2 flex items-center">
            <NavSearch variant="icon" />
          </span>
        </nav>

        {/* right side */}
        <div className="flex min-w-0 items-center justify-end gap-2.5" onMouseEnter={closeMenu}>
          <button
            type="button"
            onClick={() => openAuth("login")}
            className="hidden rounded-full bg-accent px-5 py-2 text-[0.9rem] font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 sm:inline-block"
          >
            {nav.login.label}
          </button>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-accent/40 hover:bg-paper lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* desktop floating flyout */}
      {menu && (
        <div className="absolute inset-x-0 top-full hidden px-2 lg:block pointer-events-none">
          {/* pt-2 is the visual gap under the bar, but it lives *inside* the
              hover region — an invisible bridge so crossing it doesn't count
              as leaving the flyout. */}
          <div
            className={cn(
              // Same curve and duration as the bar, so an open flyout narrows
              // in step with it instead of snapping to the new width.
              "pointer-events-auto mx-auto pt-2 transition-[max-width] duration-500 ease-nav motion-reduce:transition-none",
              scrolled ? "max-w-5xl" : "max-w-6xl"
            )}
            onMouseEnter={() => handleMouseEnter()}
            onMouseLeave={handleMouseLeave}
          >
            <div className="animate-dropdown overflow-hidden rounded-2xl border border-line bg-card/95 shadow-xl backdrop-blur-xl transition-all duration-300">
            {/* thin accent hairline across the top */}
            <span className="block h-0.5 w-full bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="p-7">
              {menu === "platform" ? (
                <>
                  <div className="grid grid-cols-3 gap-x-8">
                    {platformMenu.groups.map((g, i) => (
                      <div
                        key={g.title}
                        className={
                          i > 0
                            ? "relative before:absolute before:-left-4 before:top-8 before:bottom-1 before:w-px before:bg-line-2"
                            : ""
                        }
                      >
                        <p className="mb-3 flex items-center gap-2 px-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-faint">
                          <span className="h-1 w-1 rounded-full bg-accent" />
                          {g.title}
                        </p>
                        <div className="grid gap-2">
                          {g.links.map((l) => (
                            <MenuTile key={l.label} {...l} onClick={() => setMenu(null)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <FeatureStrip {...platformMenu.promo} />
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 flex items-center gap-2 px-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-faint">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    By industry
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {industries.items.map((it) => (
                      <MenuTile key={it.name} icon={it.icon} label={it.name} href={`/industries/${it.slug}`} onClick={() => setMenu(null)} />
                    ))}
                  </div>
                  <div className="mt-6">
                    <FeatureStrip {...industriesMenu.promo} />
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* mobile floating menu */}
      {open && (
        <div className="absolute left-2 right-2 top-full mt-2 lg:hidden">
          <div className="overflow-hidden rounded-2xl border border-line bg-card/95 shadow-xl backdrop-blur-xl">
            <div className="border-b border-line-2 px-5 py-3">
              <NavSearch onNavigate={() => setOpen(false)} />
            </div>
            {/* Same source as the desktop bar — the two must never drift apart.
                Dropdown triggers become accordions instead of flyouts. */}
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain px-5 py-2">
              <div className="flex flex-col divide-y divide-line-2">
                {nav.primary.map((item) =>
                  "menu" in item && item.menu ? (
                    <div key={item.label}>
                      <button
                        type="button"
                        aria-expanded={section === item.menu}
                        onClick={() => setSection((s) => (s === item.menu ? null : item.menu!))}
                        className={cn(
                          "flex w-full items-center justify-between py-3 text-[0.95rem] font-medium transition-colors",
                          section === item.menu ? "text-accent" : "text-ink"
                        )}
                      >
                        {item.label}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-300",
                            section === item.menu && "rotate-180"
                          )}
                        />
                      </button>

                      {section === item.menu && (
                        <div className="pb-3">
                          {item.menu === "platform"
                            ? platformMenu.groups.map((g) => (
                                <div key={g.title} className="mb-3 last:mb-0">
                                  <p className="mb-1 flex items-center gap-2 px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-faint">
                                    <span className="h-1 w-1 rounded-full bg-accent" />
                                    {g.title}
                                  </p>
                                  <div className="grid gap-0.5">
                                    {g.links.map((l) => (
                                      <MobileSubLink key={l.label} {...l} onClick={() => setOpen(false)} />
                                    ))}
                                  </div>
                                </div>
                              ))
                            : (
                              <div className="grid gap-0.5">
                                {industries.items.map((it) => (
                                  <MobileSubLink
                                    key={it.name}
                                    icon={it.icon}
                                    label={it.name}
                                    href={`/industries/${it.slug}`}
                                    onClick={() => setOpen(false)}
                                  />
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="py-3 text-[0.95rem] font-medium text-ink"
                    >
                      {item.label}
                    </Link>
                  )
                )}

                <div className="flex gap-2.5 pb-3 pt-3">
                  <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="flex-1 rounded-full border border-line bg-paper px-5 py-3 text-center text-sm font-semibold text-ink"
                  >
                    {nav.login.label}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>

    <AuthModal
      open={auth !== null}
      mode={auth ?? "login"}
      onModeChange={setAuth}
      onClose={() => setAuth(null)}
    />
    </>
  );
}
