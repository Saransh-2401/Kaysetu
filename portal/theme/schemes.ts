// frontend/theme/schemes.ts
// Premade color schemes for the whole CRM.
// PURE DATA — no "use client", no DOM, no next/font. Safe to import from BOTH
// server components (e.g. app/layout.tsx no-flash script) and client components.

import { lighten, darken, readableOn } from "./colorMath";

export interface SchemeSurfaces {
  background: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
}

export interface ColorScheme {
  /** stable key persisted to the backend / cookie / localStorage */
  key: string;
  /** human label shown in the admin Appearance picker */
  name: string;
  description: string;

  // Brand
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  // Semantic (status) colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // 5-series chart palette (recharts / analytics)
  chart: [string, string, string, string, string];

  // Surfaces per mode
  light: SchemeSurfaces;
  dark: SchemeSurfaces;

  /** end color of the primary-button gradient (start = `primary`) */
  gradientEnd: string;
}

// Shared semantic colors — kept consistent across schemes for predictable
// status readability (paid/pending/approved/rejected etc.).
const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const ERROR = "#DC2626";
const INFO = "#0EA5E9";

// Shared dark surfaces (deep slate) — every scheme uses the same dark canvas;
// only the brand/accent hues change in dark mode.
const DARK: SchemeSurfaces = {
  background: "#0F172A",
  paper: "#1E293B",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
};

export const SCHEMES: ColorScheme[] = [
  {
    key: "navy-gold",
    name: "Navy & Gold",
    description: "The signature KaySetu luxury palette — deep slate blue with gold accents.",
    primary: "#2C3E50",
    primaryLight: "#5D6D7E",
    primaryDark: "#1A252F",
    secondary: "#D4AF37",
    secondaryLight: "#F4D03F",
    secondaryDark: "#B7950B",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#2C3E50", "#D4AF37", "#1ABC9C", "#E67E22", "#5D6D7E"],
    light: { background: "#E5DFD4", paper: "#FDFBF7", textPrimary: "#2C3E50", textSecondary: "#546E7A" },
    dark: DARK,
    gradientEnd: "#34495E",
  },
  {
    key: "emerald-fresh",
    name: "Emerald Fresh",
    description: "Crisp emerald green with amber accents — clean and energetic for FMCG.",
    primary: "#047857",
    primaryLight: "#10B981",
    primaryDark: "#065F46",
    secondary: "#F59E0B",
    secondaryLight: "#FBBF24",
    secondaryDark: "#B45309",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#047857", "#F59E0B", "#0EA5E9", "#8B5CF6", "#10B981"],
    light: { background: "#EEF2EF", paper: "#FFFFFF", textPrimary: "#1F2937", textSecondary: "#6B7280" },
    dark: DARK,
    gradientEnd: "#059669",
  },
  {
    key: "royal-indigo",
    name: "Royal Indigo",
    description: "Modern SaaS indigo with a pink accent — confident and vibrant.",
    primary: "#4338CA",
    primaryLight: "#6366F1",
    primaryDark: "#3730A3",
    secondary: "#EC4899",
    secondaryLight: "#F472B6",
    secondaryDark: "#BE185D",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#4338CA", "#EC4899", "#0EA5E9", "#F59E0B", "#14B8A6"],
    light: { background: "#EEF0FB", paper: "#FFFFFF", textPrimary: "#1E1B4B", textSecondary: "#6B7280" },
    dark: DARK,
    gradientEnd: "#4F46E5",
  },
  {
    key: "ocean-blue",
    name: "Ocean Blue",
    description: "Clean corporate sky-blue paired with teal — calm and trustworthy.",
    primary: "#0369A1",
    primaryLight: "#0EA5E9",
    primaryDark: "#075985",
    secondary: "#14B8A6",
    secondaryLight: "#2DD4BF",
    secondaryDark: "#0F766E",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#0369A1", "#14B8A6", "#F59E0B", "#8B5CF6", "#0EA5E9"],
    light: { background: "#EAF2F7", paper: "#FFFFFF", textPrimary: "#0F2A3F", textSecondary: "#5B7488" },
    dark: DARK,
    gradientEnd: "#0284C7",
  },
  {
    key: "sunset-orange",
    name: "Sunset Orange",
    description: "Warm burnt-orange with charcoal — bold and high-energy.",
    primary: "#C2410C",
    primaryLight: "#EA580C",
    primaryDark: "#9A3412",
    secondary: "#1F2937",
    secondaryLight: "#374151",
    secondaryDark: "#111827",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#C2410C", "#1F2937", "#0EA5E9", "#16A34A", "#F59E0B"],
    light: { background: "#FBF1EA", paper: "#FFFFFF", textPrimary: "#1F2937", textSecondary: "#6B7280" },
    dark: DARK,
    gradientEnd: "#EA580C",
  },
  {
    key: "graphite-mono",
    name: "Graphite Mono",
    description: "Minimal near-black monochrome with a single blue accent.",
    primary: "#111827",
    primaryLight: "#374151",
    primaryDark: "#030712",
    secondary: "#2563EB",
    secondaryLight: "#3B82F6",
    secondaryDark: "#1D4ED8",
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    info: INFO,
    chart: ["#111827", "#2563EB", "#6B7280", "#9CA3AF", "#3B82F6"],
    light: { background: "#F3F4F6", paper: "#FFFFFF", textPrimary: "#111827", textSecondary: "#6B7280" },
    dark: DARK,
    gradientEnd: "#374151",
  },
];

export const DEFAULT_SCHEME_KEY = "navy-gold";
export const CUSTOM_SCHEME_KEY = "custom";

export const SCHEME_COOKIE = "kaysetu_scheme";
export const SCHEME_STORAGE_KEY = "kaysetu_scheme";
export const SCHEME_CUSTOM_COOKIE = "kaysetu_scheme_custom";
export const SCHEME_CUSTOM_STORAGE_KEY = "kaysetu_scheme_custom";

export function getScheme(key: string | null | undefined): ColorScheme {
  return SCHEMES.find((s) => s.key === key) ?? SCHEMES[0];
}

// --- Custom scheme (admin-defined palette) ---

/** The handful of colors an admin actually picks; the rest is derived. */
export interface CustomSchemeInput {
  name?: string;
  primary: string;
  secondary: string;
  background: string;
  paper: string;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
}

/** A sensible starting point for the custom editor (seeded from Navy & Gold). */
export const DEFAULT_CUSTOM_INPUT: CustomSchemeInput = {
  name: "Custom",
  primary: "#2C3E50",
  secondary: "#D4AF37",
  background: "#E5DFD4",
  paper: "#FDFBF7",
  success: SUCCESS,
  warning: WARNING,
  error: ERROR,
  info: INFO,
};

/** Build a full ColorScheme from the admin's partial custom input. */
export function buildCustomScheme(input: CustomSchemeInput): ColorScheme {
  const primary = input.primary || DEFAULT_CUSTOM_INPUT.primary;
  const secondary = input.secondary || DEFAULT_CUSTOM_INPUT.secondary;
  const background = input.background || DEFAULT_CUSTOM_INPUT.background;
  const paper = input.paper || DEFAULT_CUSTOM_INPUT.paper;
  const success = input.success || SUCCESS;
  const warning = input.warning || WARNING;
  const error = input.error || ERROR;
  const info = input.info || INFO;
  const onLight = readableOn(background);
  return {
    key: CUSTOM_SCHEME_KEY,
    name: input.name || "Custom",
    description: "Your custom palette.",
    primary,
    primaryLight: lighten(primary, 0.18),
    primaryDark: darken(primary, 0.18),
    secondary,
    secondaryLight: lighten(secondary, 0.18),
    secondaryDark: darken(secondary, 0.18),
    success,
    warning,
    error,
    info,
    chart: [primary, secondary, success, info, warning],
    light: {
      background,
      paper,
      textPrimary: onLight === "#FFFFFF" ? "#F1F5F9" : "#1F2937",
      textSecondary: onLight === "#FFFFFF" ? "#94A3B8" : "#6B7280",
    },
    dark: DARK,
    gradientEnd: darken(primary, 0.12),
  };
}

/** Resolve either a premade scheme by key, or the custom scheme from input. */
export function resolveScheme(
  key: string | null | undefined,
  custom?: CustomSchemeInput | null
): ColorScheme {
  if (key === CUSTOM_SCHEME_KEY && custom) return buildCustomScheme(custom);
  return getScheme(key);
}
