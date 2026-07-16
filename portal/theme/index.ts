"use client";
import { createTheme, PaletteMode, alpha } from "@mui/material/styles";
import { resolveScheme, DEFAULT_SCHEME_KEY, CustomSchemeInput } from "./schemes";
import { getFont, DEFAULT_FONT_KEY, cinzel } from "./fonts";

export const getTheme = (
  mode: PaletteMode,
  schemeKey: string = DEFAULT_SCHEME_KEY,
  custom?: CustomSchemeInput | null,
  fontKey: string = DEFAULT_FONT_KEY
) => {
  const scheme = resolveScheme(schemeKey, custom);
  const surfaces = mode === "light" ? scheme.light : scheme.dark;
  const bodyFont = getFont(fontKey).family;
  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: scheme.primary,
        light: scheme.primaryLight,
        dark: scheme.primaryDark,
        contrastText: "#ffffff",
      },
      secondary: {
        main: scheme.secondary,
        light: scheme.secondaryLight,
        dark: scheme.secondaryDark,
        contrastText: scheme.primary,
      },
      success: { main: scheme.success },
      warning: { main: scheme.warning },
      error: { main: scheme.error },
      info: { main: scheme.info },
      background: {
        default: surfaces.background,
        paper: surfaces.paper,
      },
      text: {
        primary: surfaces.textPrimary,
        secondary: surfaces.textSecondary,
      },
      action: {
        active: mode === "light" ? "rgba(0, 0, 0, 0.54)" : "rgba(255, 255, 255, 0.7)",
        hover: mode === "light" ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.08)",
        selected: mode === "light" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.16)",
        disabled: mode === "light" ? "rgba(0, 0, 0, 0.38) " : "rgba(255, 255, 255, 0.3)",
        disabledBackground: mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
      },
    },
    typography: {
      fontFamily: bodyFont,
      // Massive Hero Heading
      h1: {
        fontSize: "3.5rem",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      },
      // Section Headings
      h2: {
        fontSize: "2.5rem",
        fontWeight: 700,
        letterSpacing: "-0.01em",
      },
      // LOGO STYLE (Using Cinzel)
      h4: {
        fontFamily: cinzel.style.fontFamily,
        fontWeight: 700,
        letterSpacing: "0.05em",
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "1rem",
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "10px",
            padding: "10px 24px",
            boxShadow: "none",
            transition: "all 0.2s ease-in-out",
            "&.Mui-disabled": {
              // Ensure disabled text isn't too dark; use more muted/lighter tones
              color: mode === "light" ? "rgba(0, 0, 0, 0.26)" : "rgba(255, 255, 255, 0.3)",
            },
          },
          contained: {
            "&.Mui-disabled": {
              backgroundColor: mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
              color: mode === "light" ? "rgba(0, 0, 0, 0.26)" : "rgba(255, 255, 255, 0.3)",
            },
          },
          containedPrimary: {
            // Subtle gradient for primary buttons (follows the active scheme)
            background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: `0px 8px 20px ${alpha(scheme.primary, 0.4)}`,
            },
            "&.Mui-disabled": {
              background: mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
            }
          },
          outlined: {
            borderWidth: "2px",
            "&:hover": {
              borderWidth: "2px",
              backgroundColor: alpha(scheme.primary, 0.05),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "transparent",
            backdropFilter: "blur(12px)",
            boxShadow: "none",
            borderBottom: "1px solid",
            borderColor:
              mode === "light"
                ? alpha(scheme.primary, 0.08)
                : "rgba(255, 255, 255, 0.08)",
          },
        },
      },
    },
  });
};