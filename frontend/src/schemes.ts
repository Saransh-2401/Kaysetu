/**
 * Premade color schemes for tenant Appearance — ported from the previous
 * platform's scheme registry. Pure data: safe for server and client imports.
 * The tenant's pick is stored in OrgSettings.appearance.scheme.
 */
export interface ColorScheme {
  key: string;
  name: string;
  description: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryDark: string;
  background: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
  gradientEnd: string;
}

export const SCHEMES: ColorScheme[] = [
  {
    key: "navy-gold",
    name: "Navy & Gold",
    description: "The signature Salexa palette — deep slate blue with gold accents.",
    primary: "#2C3E50", primaryLight: "#5D6D7E", primaryDark: "#1A252F",
    secondary: "#D4AF37", secondaryDark: "#B7950B",
    background: "#F4F1EA", paper: "#FDFBF7",
    textPrimary: "#2C3E50", textSecondary: "#546E7A",
    gradientEnd: "#34495E",
  },
  {
    key: "emerald-fresh",
    name: "Emerald Fresh",
    description: "Crisp emerald green with amber accents — clean and energetic.",
    primary: "#047857", primaryLight: "#10B981", primaryDark: "#065F46",
    secondary: "#F59E0B", secondaryDark: "#B45309",
    background: "#EEF2EF", paper: "#FFFFFF",
    textPrimary: "#1F2937", textSecondary: "#6B7280",
    gradientEnd: "#059669",
  },
  {
    key: "royal-indigo",
    name: "Royal Indigo",
    description: "Modern SaaS indigo with a pink accent — confident and vibrant.",
    primary: "#4338CA", primaryLight: "#6366F1", primaryDark: "#3730A3",
    secondary: "#EC4899", secondaryDark: "#BE185D",
    background: "#EEF0F7", paper: "#FFFFFF",
    textPrimary: "#1F2937", textSecondary: "#6B7280",
    gradientEnd: "#6366F1",
  },
  {
    key: "ocean-teal",
    name: "Ocean Teal",
    description: "Calm teal with coral accents — friendly for services businesses.",
    primary: "#0F766E", primaryLight: "#14B8A6", primaryDark: "#115E59",
    secondary: "#F97316", secondaryDark: "#C2410C",
    background: "#ECF3F2", paper: "#FFFFFF",
    textPrimary: "#134E4A", textSecondary: "#5F7470",
    gradientEnd: "#0D9488",
  },
  {
    key: "slate-mono",
    name: "Slate Mono",
    description: "Quiet monochrome slate — minimal and distraction-free.",
    primary: "#334155", primaryLight: "#64748B", primaryDark: "#1E293B",
    secondary: "#0EA5E9", secondaryDark: "#0369A1",
    background: "#F1F5F9", paper: "#FFFFFF",
    textPrimary: "#0F172A", textSecondary: "#64748B",
    gradientEnd: "#475569",
  },
];

export const DEFAULT_SCHEME_KEY = "navy-gold";

export function getScheme(key?: string | null): ColorScheme {
  return SCHEMES.find((scheme) => scheme.key === key) ?? SCHEMES[0];
}
