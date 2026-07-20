// frontend/theme/fonts.ts
// Global font registry. Fonts are loaded via next/font (build-time, self-hosted,
// no FOUT). Both the SSR layout (server) and the MUI theme/provider (client)
// import this to resolve the active font's family string.
//
// NOTE: no "use client" — next/font works in both server and client modules.

import {
  Roboto,
  Inter,
  Poppins,
  Montserrat,
  Open_Sans,
  Lato,
  Nunito,
  Work_Sans,
  Plus_Jakarta_Sans,
  Cinzel,
} from "next/font/google";

const roboto = Roboto({ weight: ["300", "400", "500", "700"], subsets: ["latin"], display: "swap" });
const inter = Inter({ subsets: ["latin"], display: "swap" });
const poppins = Poppins({ weight: ["300", "400", "500", "600", "700"], subsets: ["latin"], display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap" });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap" });
const lato = Lato({ weight: ["300", "400", "700"], subsets: ["latin"], display: "swap" });
const nunito = Nunito({ subsets: ["latin"], display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

// Brand display font for the KAYSETU wordmark (logo) — kept regardless of body font.
export const cinzel = Cinzel({ weight: ["400", "600", "700", "800"], subsets: ["latin"], display: "swap" });

// Re-exported so theme/index.ts can fall back to Roboto.
export { roboto };

export interface FontOption {
  key: string;
  name: string;
  /** Resolved CSS font-family value (hashed next/font family + fallbacks). */
  family: string;
  /** Short vibe note for the picker. */
  note: string;
}

export const FONTS: FontOption[] = [
  { key: "roboto", name: "Roboto", family: roboto.style.fontFamily, note: "Clean, neutral default" },
  { key: "inter", name: "Inter", family: inter.style.fontFamily, note: "Modern UI standard" },
  { key: "poppins", name: "Poppins", family: poppins.style.fontFamily, note: "Geometric, friendly" },
  { key: "montserrat", name: "Montserrat", family: montserrat.style.fontFamily, note: "Confident, wide" },
  { key: "open-sans", name: "Open Sans", family: openSans.style.fontFamily, note: "Highly legible" },
  { key: "lato", name: "Lato", family: lato.style.fontFamily, note: "Warm, professional" },
  { key: "nunito", name: "Nunito", family: nunito.style.fontFamily, note: "Soft, rounded" },
  { key: "work-sans", name: "Work Sans", family: workSans.style.fontFamily, note: "Crisp, business" },
  { key: "jakarta", name: "Plus Jakarta Sans", family: jakarta.style.fontFamily, note: "Premium, contemporary" },
];

export const DEFAULT_FONT_KEY = "roboto";
export const FONT_COOKIE = "kaysetu_font";
export const FONT_STORAGE_KEY = "kaysetu_font";

export function getFont(key: string | null | undefined): FontOption {
  return FONTS.find((f) => f.key === key) ?? FONTS[0];
}
