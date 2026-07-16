"use client";
/**
 * Salexa signature theme — "Navy & Gold", ported from the previous platform's
 * scheme registry so the SaaS keeps the same look. The full multi-scheme
 * Appearance module (per-tenant) arrives with the portal settings phase.
 */
import { createTheme } from "@mui/material/styles";

export const BRAND = {
  primary: "#2C3E50",
  primaryLight: "#5D6D7E",
  primaryDark: "#1A252F",
  secondary: "#D4AF37",
  secondaryDark: "#B7950B",
  background: "#F4F1EA",
  paper: "#FDFBF7",
  textPrimary: "#2C3E50",
  textSecondary: "#546E7A",
  gradientEnd: "#34495E",
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: BRAND.primary, light: BRAND.primaryLight, dark: BRAND.primaryDark },
    secondary: { main: BRAND.secondary, dark: BRAND.secondaryDark },
    success: { main: "#16A34A" },
    warning: { main: "#F59E0B" },
    error: { main: "#DC2626" },
    info: { main: "#0EA5E9" },
    background: { default: BRAND.background, paper: BRAND.paper },
    text: { primary: BRAND.textPrimary, secondary: BRAND.textSecondary },
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
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.gradientEnd} 100%)`,
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableHead: {
      styleOverrides: {
        root: { "& .MuiTableCell-head": { fontWeight: 700, background: "#EFEAE0" } },
      },
    },
  },
});
