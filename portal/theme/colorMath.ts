// frontend/theme/colorMath.ts
// Pure hex color helpers — no deps, safe on server + client. Used to derive
// light/dark variants and readable foregrounds for custom color schemes.

function normalizeHex(hex: string): string {
  const h = (hex || "").replace("#", "").trim();
  if (h.length === 3) return h.split("").map((c) => c + c).join("");
  return h.padEnd(6, "0").slice(0, 6);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Mix toward white by amount 0..1. */
export function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Mix toward black by amount 0..1. */
export function darken(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

/** Pick a readable foreground (white or near-black) for a background hex. */
export function readableOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#0F172A" : "#FFFFFF";
}

/** Basic 6-digit hex validation (accepts leading #). */
export function isHexColor(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test((hex || "").trim());
}
