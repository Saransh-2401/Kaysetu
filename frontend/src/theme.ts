"use client";
/**
 * Ops console theme. Deliberately the SAME design language as the tenant portal
 * (portal/theme/index.ts): Navy & Gold palette, radius 12, gradient primary
 * buttons with lift, Cinzel wordmark, and a glassmorphic AppBar — so the two
 * apps read as one product. Single scheme (navy-gold, light) since the ops
 * console is not per-tenant themed.
 */
import { alpha, createTheme, type Theme } from "@mui/material/styles";

import { cinzel, roboto } from "@/fonts";
import { getScheme, type ColorScheme } from "@/schemes";

export function buildTheme(scheme: ColorScheme): Theme {
  return createTheme({
    palette: {
      mode: "light",
      primary: {
        main: scheme.primary,
        light: scheme.primaryLight,
        dark: scheme.primaryDark,
        contrastText: "#ffffff",
      },
      secondary: { main: scheme.secondary, dark: scheme.secondaryDark, contrastText: scheme.primary },
      success: { main: "#16A34A" },
      warning: { main: "#F59E0B" },
      error: { main: "#DC2626" },
      info: { main: "#0EA5E9" },
      background: { default: scheme.background, paper: scheme.paper },
      text: { primary: scheme.textPrimary, secondary: scheme.textSecondary },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: roboto.style.fontFamily,
      h1: { fontSize: "3.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
      h2: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
      // The wordmark font, matching the portal's logo styling.
      h4: { fontFamily: cinzel.style.fontFamily, fontWeight: 700, letterSpacing: "0.05em" },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600, fontSize: "1rem" },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "10px",
            padding: "10px 24px",
            boxShadow: "none",
            transition: "all 0.2s ease-in-out",
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: `0px 8px 20px ${alpha(scheme.primary, 0.4)}`,
            },
          },
          outlined: {
            borderWidth: "2px",
            "&:hover": { borderWidth: "2px", backgroundColor: alpha(scheme.primary, 0.05) },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "transparent",
            backdropFilter: "blur(12px)",
            boxShadow: "none",
            borderBottom: "1px solid",
            borderColor: alpha(scheme.primary, 0.08),
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: { "& .MuiTableCell-head": { fontWeight: 700, background: "rgba(0,0,0,0.04)" } },
        },
      },
    },
  });
}

export const theme = buildTheme(getScheme("navy-gold"));
