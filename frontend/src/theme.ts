"use client";
/**
 * Theme factory. Marketing + Ops use the signature Navy & Gold; the tenant
 * portal builds its theme from the org's Appearance pick (see src/schemes.ts).
 */
import { createTheme, type Theme } from "@mui/material/styles";

import { getScheme, type ColorScheme } from "@/schemes";

export function buildTheme(scheme: ColorScheme): Theme {
  return createTheme({
    palette: {
      mode: "light",
      primary: { main: scheme.primary, light: scheme.primaryLight, dark: scheme.primaryDark },
      secondary: { main: scheme.secondary, dark: scheme.secondaryDark },
      success: { main: "#16A34A" },
      warning: { main: "#F59E0B" },
      error: { main: "#DC2626" },
      info: { main: "#0EA5E9" },
      background: { default: scheme.background, paper: scheme.paper },
      text: { primary: scheme.textPrimary, secondary: scheme.textSecondary },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          containedPrimary: {
            background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiTableHead: {
        styleOverrides: {
          root: { "& .MuiTableCell-head": { fontWeight: 700, background: "rgba(0,0,0,0.05)" } },
        },
      },
    },
  });
}

export const theme = buildTheme(getScheme("navy-gold"));
