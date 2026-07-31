"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import Icon from "@/components/Icon";
import { nav, brand, platformMenu, industriesMenu, industries } from "@/lib/content";
import { cn } from "@/lib/utils";

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

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<null | "platform" | "industries">(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full px-2"
      onMouseLeave={() => setMenu(null)}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between px-5 py-3 transition-all duration-300",
          scrolled || menu
            ? "max-w-5xl rounded-full border border-line bg-card/90 shadow-md backdrop-blur-xl"
            : "max-w-6xl bg-transparent"
        )}
      >
        <div className="flex items-center gap-8">
          <Logo />

          {/* desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.primary.map((item) =>
              "menu" in item && item.menu ? (
                <button
                  key={item.label}
                  onMouseEnter={() => setMenu(item.menu!)}
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
                  onMouseEnter={() => setMenu(null)}
                  className="rounded-md px-3 py-2 text-[0.9rem] font-medium text-ink/75 transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              )
            )}
          </nav>
        </div>

        {/* right side */}
        <div className="flex items-center gap-2.5">

          <a
            href={nav.demo.href}
            className="hidden rounded-full border border-line bg-paper px-4 py-2 text-[0.9rem] font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-paper-2 sm:inline-block"
          >
            {nav.demo.label}
          </a>
          <a
            href={nav.cta.href}
            className="hidden rounded-full bg-accent px-5 py-2 text-[0.9rem] font-semibold text-white transition-colors hover:bg-accent/90 sm:inline-flex sm:items-center sm:gap-1.5"
          >
            {nav.cta.label}
          </a>
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
        <div className="absolute inset-x-0 top-full hidden px-2 lg:block">
          <div
            className={cn(
              "animate-dropdown mx-auto mt-2 overflow-hidden rounded-2xl border border-line bg-card/95 shadow-xl backdrop-blur-xl transition-all duration-300",
              scrolled ? "max-w-5xl" : "max-w-6xl"
            )}
          >
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
      )}

      {/* mobile floating menu */}
      {open && (
        <div className="absolute left-2 right-2 top-full mt-2 lg:hidden">
          <div className="overflow-hidden rounded-2xl border border-line bg-card/95 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col divide-y divide-line-2 px-5 py-2">
              <Link href="/#walkthrough" onClick={() => setOpen(false)} className="py-3 text-[0.95rem] font-medium text-ink">Walkthrough</Link>
            <Link href="/industries" onClick={() => setOpen(false)} className="py-3 text-[0.95rem] font-medium text-ink">Industries</Link>
            <Link href="/#workspace" onClick={() => setOpen(false)} className="py-3 text-[0.95rem] font-medium text-ink">Workspace</Link>
            <Link href="/#built-for" onClick={() => setOpen(false)} className="py-3 text-[0.95rem] font-medium text-ink">Built for</Link>
            <Link href="/#proof" onClick={() => setOpen(false)} className="py-3 text-[0.95rem] font-medium text-ink">Customers</Link>

            <div className="flex gap-2.5 pb-3 pt-3">
              <a
                href={nav.demo.href}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-line bg-paper px-5 py-3 text-center text-sm font-semibold text-ink"
              >
                {nav.demo.label}
              </a>
              <a
                href={nav.cta.href}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-espresso px-5 py-3 text-center text-sm font-semibold text-card"
              >
                {nav.cta.label}
              </a>
            </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
