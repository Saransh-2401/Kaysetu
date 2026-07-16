// frontend/theme/cssVars.ts
// Turns a ColorScheme into CSS custom properties that drive BOTH the
// shadcn/Tailwind tokens (--primary, --secondary, --chart-*, --sidebar-*, …)
// AND a set of app-level tokens (--app-*) used to replace hardcoded hex.
//
// PURE — no "use client". `schemeToVars` is safe to run on the server (used by
// the no-flash inline script in app/layout.tsx). `applyScheme` touches the DOM
// and must only be called in the browser.

import { ColorScheme, SCHEMES, resolveScheme, CustomSchemeInput } from "./schemes";
import { readableOn } from "./colorMath";

type Mode = "light" | "dark";

export { readableOn };

/** Soft border tone derived from mode (neutral, scheme-agnostic). */
function border(mode: Mode): string {
  return mode === "light" ? "#E2E0DA" : "rgba(255,255,255,0.12)";
}
function muted(mode: Mode): string {
  return mode === "light" ? "#EFEDE7" : "#243042";
}
function mutedText(mode: Mode): string {
  return mode === "light" ? "#6B7280" : "#94A3B8";
}

/**
 * Full CSS-variable map for a scheme + mode.
 * Returns a flat record of `--var: value`. Used by applyScheme (client) and the
 * no-flash script (server) so the two never drift.
 */
export function schemeToVars(scheme: ColorScheme, mode: Mode): Record<string, string> {
  const s = mode === "light" ? scheme.light : scheme.dark;
  const onPrimary = readableOn(scheme.primary);
  const onSecondary = readableOn(scheme.secondary);

  return {
    // --- shadcn / Tailwind tokens (previously hardcoded grayscale in globals.css) ---
    "--background": s.background,
    "--foreground": s.textPrimary,
    "--card": s.paper,
    "--card-foreground": s.textPrimary,
    "--popover": s.paper,
    "--popover-foreground": s.textPrimary,
    "--primary": scheme.primary,
    "--primary-foreground": onPrimary,
    "--secondary": scheme.secondary,
    "--secondary-foreground": onSecondary,
    "--muted": muted(mode),
    "--muted-foreground": mutedText(mode),
    "--accent": scheme.secondary,
    "--accent-foreground": onSecondary,
    "--destructive": scheme.error,
    "--border": border(mode),
    "--input": border(mode),
    "--ring": scheme.primary,
    "--chart-1": scheme.chart[0],
    "--chart-2": scheme.chart[1],
    "--chart-3": scheme.chart[2],
    "--chart-4": scheme.chart[3],
    "--chart-5": scheme.chart[4],
    "--sidebar": s.paper,
    "--sidebar-foreground": s.textPrimary,
    "--sidebar-primary": scheme.primary,
    "--sidebar-primary-foreground": onPrimary,
    "--sidebar-accent": scheme.secondary,
    "--sidebar-accent-foreground": onSecondary,
    "--sidebar-border": border(mode),
    "--sidebar-ring": scheme.primary,

    // --- App-level tokens (replace hardcoded hex; consumed via var(--app-*)) ---
    "--app-primary": scheme.primary,
    "--app-primary-light": scheme.primaryLight,
    "--app-primary-dark": scheme.primaryDark,
    "--app-on-primary": onPrimary,
    "--app-secondary": scheme.secondary,
    "--app-secondary-light": scheme.secondaryLight,
    "--app-secondary-dark": scheme.secondaryDark,
    "--app-on-secondary": onSecondary,
    "--app-success": scheme.success,
    "--app-warning": scheme.warning,
    "--app-error": scheme.error,
    "--app-info": scheme.info,
    "--app-bg": s.background,
    "--app-paper": s.paper,
    "--app-text": s.textPrimary,
    "--app-text-secondary": s.textSecondary,
    "--app-border": border(mode),
    "--app-gradient": `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
    "--app-chart-1": scheme.chart[0],
    "--app-chart-2": scheme.chart[1],
    "--app-chart-3": scheme.chart[2],
    "--app-chart-4": scheme.chart[3],
    "--app-chart-5": scheme.chart[4],
  };
}

/** Apply a scheme (premade or custom) to the document root (client only). */
export function applyScheme(
  schemeKey: string,
  mode: Mode,
  custom?: CustomSchemeInput | null
): void {
  if (typeof document === "undefined") return;
  const scheme = resolveScheme(schemeKey, custom);
  const root = document.documentElement;
  const vars = schemeToVars(scheme, mode);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute("data-scheme", scheme.key);
  root.style.colorScheme = mode;
  root.classList.toggle("dark", mode === "dark");
}

/**
 * Serializable maps for every scheme/mode — embedded into the no-flash inline
 * script so first paint matches the active scheme before React hydrates.
 */
export function buildVarTable(): Record<string, { light: Record<string, string>; dark: Record<string, string> }> {
  const table: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {};
  for (const s of SCHEMES) {
    table[s.key] = { light: schemeToVars(s, "light"), dark: schemeToVars(s, "dark") };
  }
  return table;
}
