"use client";
/**
 * Ops console theme.
 *
 * Deliberately the SAME design language as the tenant portal (portal/theme/index.ts)
 * so ops.kaysetu.in and app.kaysetu.in read as one product: Navy & Gold palette,
 * Cinzel wordmark, gradient primary buttons with lift, glassmorphic AppBar.
 *
 * Where it differs is DENSITY. The portal is a business app; this is an operations
 * console — the "Data-Dense Dashboard" pattern. So the shared tokens below tighten
 * table rows, inputs and chips, and every surface is a hairline-bordered flat card
 * instead of a shadowed one. Radii are a deliberate 3-step scale (8 / 12 / 16)
 * rather than MUI's single `shape.borderRadius`, because mixing arbitrary radii is
 * the single biggest reason an admin UI reads as unpolished.
 *
 * Single scheme (navy-gold, light) — the ops console is not per-tenant themed.
 */
import { alpha, createTheme, type Theme } from "@mui/material/styles";

import { cinzel, roboto } from "@/fonts";
import { getScheme, type ColorScheme } from "@/schemes";

/** Radius scale. Use these, never a raw number, so every corner agrees. */
export const RADIUS = {
  /** Controls: buttons, inputs, chips-with-radius, icon buttons. */
  sm: "8px",
  /** Cards, dialogs, popovers, nav items. */
  md: "12px",
  /** Full-bleed feature panels only. */
  lg: "16px",
} as const;

/** The one shadow the console is allowed to use, plus its hover step. */
export const ELEVATION = {
  card: "0 1px 2px rgba(16, 24, 40, 0.04)",
  hover: "0 6px 24px rgba(16, 24, 40, 0.08)",
  overlay: "0 16px 48px rgba(16, 24, 40, 0.16)",
} as const;

export function buildTheme(scheme: ColorScheme): Theme {
  const gold = scheme.secondary;
  const slate = scheme.primary;

  return createTheme({
    palette: {
      mode: "light",
      primary: {
        main: scheme.primary,
        light: scheme.primaryLight,
        dark: scheme.primaryDark,
        contrastText: "#ffffff",
      },
      secondary: {
        main: scheme.secondary,
        dark: scheme.secondaryDark,
        contrastText: scheme.primary,
      },
      success: { main: "#16A34A", dark: "#15803D" },
      warning: { main: "#F59E0B", dark: "#B45309" },
      error: { main: "#DC2626", dark: "#B91C1C" },
      info: { main: "#0EA5E9", dark: "#0369A1" },
      background: { default: scheme.background, paper: scheme.paper },
      text: { primary: scheme.textPrimary, secondary: scheme.textSecondary },
      divider: alpha(scheme.primary, 0.12),
    },

    shape: { borderRadius: 12 },

    typography: {
      fontFamily: roboto.style.fontFamily,
      h1: { fontSize: "3.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
      h2: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
      // The wordmark font, matching the portal's logo styling.
      h4: { fontFamily: cinzel.style.fontFamily, fontWeight: 700, letterSpacing: "0.05em" },
      h5: { fontWeight: 800, letterSpacing: "-0.02em" },
      h6: { fontWeight: 700, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 700, letterSpacing: "-0.01em" },
      subtitle2: { fontWeight: 600 },
      body2: { fontSize: "0.8125rem" },
      caption: { fontSize: "0.75rem" },
      overline: { fontWeight: 700, letterSpacing: "0.1em", fontSize: "0.65rem" },
      button: { textTransform: "none", fontWeight: 600 },
    },

    components: {
      // ── Global resets ───────────────────────────────────────────────
      MuiCssBaseline: {
        styleOverrides: {
          // Data-dense consoles live in scroll containers; a hairline scrollbar
          // keeps tables from feeling walled in by chrome.
          "*::-webkit-scrollbar": { width: 8, height: 8 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: alpha(slate, 0.18),
          },
          "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha(slate, 0.3) },
          // Every animation in the console is an entrance or a state change, so
          // honouring reduced-motion globally is safe and removes all of them.
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.01ms !important",
            },
          },
        },
      },

      // ── Surfaces ────────────────────────────────────────────────────
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: {
            borderColor: alpha(slate, 0.12),
            borderRadius: RADIUS.md,
          },
        },
      },

      // ── Controls ────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            padding: "8px 18px",
            boxShadow: "none",
            transition: "all 0.2s ease-in-out",
          },
          sizeSmall: { padding: "5px 12px", fontSize: "0.8125rem" },
          containedPrimary: {
            background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: `0 8px 20px ${alpha(scheme.primary, 0.32)}`,
            },
            // MUI greys a disabled button via `background-color`, which the
            // gradient `background` shorthand above outranks — so a disabled
            // button kept the dark fill AND took the grey label, leaving dark
            // text on a dark button. Clear the gradient explicitly.
            "&.Mui-disabled": {
              background: "rgba(0,0,0,0.12)",
              color: "rgba(0,0,0,0.38)",
              boxShadow: "none",
              transform: "none",
            },
          },
          // 1px, not the portal's 2px: at console density a 2px outline on every
          // secondary button turns a toolbar into a row of boxes.
          outlined: {
            borderWidth: 1,
            borderColor: alpha(slate, 0.24),
            "&:hover": { borderWidth: 1, backgroundColor: alpha(slate, 0.04) },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: RADIUS.sm },
          sizeSmall: { padding: 6 },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: "6px" },
          sizeSmall: { height: 22, fontSize: "0.7rem" },
          label: { paddingLeft: 8, paddingRight: 8 },
          outlined: { borderColor: alpha(slate, 0.2) },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            backgroundColor: scheme.paper,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha(slate, 0.16) },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha(slate, 0.28) },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 1.5 },
          },
          inputSizeSmall: { fontSize: "0.8125rem" },
        },
      },

      MuiInputLabel: { styleOverrides: { sizeSmall: { fontSize: "0.85rem" } } },
      MuiFormHelperText: { styleOverrides: { root: { fontSize: "0.7rem", marginLeft: 2 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: "0.8125rem", borderRadius: 6, margin: "0 4px" } } },

      // ── Tabs ────────────────────────────────────────────────────────
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44 },
          indicator: { height: 2, borderRadius: "2px 2px 0 0" },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            padding: "0 14px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            textTransform: "none",
            color: alpha(slate, 0.62),
            "&.Mui-selected": { fontWeight: 700 },
          },
        },
      },

      // ── Tables: the console's primary surface ───────────────────────
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${alpha(slate, 0.08)}`,
            padding: "10px 14px",
            fontSize: "0.8125rem",
          },
          head: {
            fontWeight: 700,
            fontSize: "0.6875rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: alpha(slate, 0.6),
            backgroundColor: alpha(slate, 0.035),
            borderBottom: `1px solid ${alpha(slate, 0.14)}`,
            whiteSpace: "nowrap",
          },
          sizeSmall: { padding: "8px 14px" },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-of-type .MuiTableCell-body": { borderBottom: 0 },
            "&.MuiTableRow-hover:hover": { backgroundColor: alpha(slate, 0.03) },
          },
        },
      },

      // ── Overlays ────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: RADIUS.md,
            border: `1px solid ${alpha(slate, 0.1)}`,
            boxShadow: ELEVATION.overlay,
          },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 700, fontSize: "1.05rem" } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            fontSize: "0.72rem",
            fontWeight: 500,
            backgroundColor: alpha(scheme.primaryDark, 0.94),
            padding: "5px 9px",
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: RADIUS.sm, fontSize: "0.8125rem", alignItems: "center" },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            backgroundColor: scheme.primaryDark,
            fontSize: "0.8125rem",
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(scheme.paper, 0.78),
            backdropFilter: "blur(16px) saturate(180%)",
            boxShadow: "none",
            borderBottom: `1px solid ${alpha(gold, 0.12)}`,
            color: scheme.textPrimary,
          },
        },
      },

      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: alpha(slate, 0.07), borderRadius: RADIUS.sm },
        },
      },

      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, height: 6 } } },
      MuiDivider: { styleOverrides: { root: { borderColor: alpha(slate, 0.1) } } },
      MuiAvatar: { styleOverrides: { rounded: { borderRadius: RADIUS.sm } } },
      MuiSwitch: { defaultProps: { size: "small" } },
      MuiCheckbox: { defaultProps: { size: "small" } },

      // Every interactive surface gets a visible focus ring — the console is
      // keyboard-driven and MUI's default ring disappears on custom backgrounds.
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&.Mui-focusVisible": {
              outline: `2px solid ${alpha(gold, 0.75)}`,
              outlineOffset: 2,
            },
          },
        },
      },
    },
  });
}

export const theme = buildTheme(getScheme("navy-gold"));
