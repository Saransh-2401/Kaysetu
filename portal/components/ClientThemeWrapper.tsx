"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { PaletteMode } from "@mui/material";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getTheme } from "@/theme";
import {
  ColorScheme,
  CustomSchemeInput,
  getScheme,
  resolveScheme,
  DEFAULT_SCHEME_KEY,
  CUSTOM_SCHEME_KEY,
  SCHEME_COOKIE,
  SCHEME_STORAGE_KEY,
  SCHEME_CUSTOM_COOKIE,
  SCHEME_CUSTOM_STORAGE_KEY,
} from "@/theme/schemes";
import { applyScheme } from "@/theme/cssVars";
import {
  FontOption,
  FONTS,
  getFont,
  DEFAULT_FONT_KEY,
  FONT_COOKIE,
  FONT_STORAGE_KEY,
} from "@/theme/fonts";
import { coreService } from "@/lib/core-service";

interface ThemeContextValue {
  mode: PaletteMode;
  toggleColorMode: () => void;
  schemeKey: string;
  scheme: ColorScheme;
  /** Select a premade scheme by key (persists locally). */
  setScheme: (key: string) => void;
  /** The active custom palette input (if any). */
  customInput: CustomSchemeInput | null;
  /** Apply a custom palette live + select the custom scheme. */
  setCustom: (input: CustomSchemeInput) => void;
  /** Active global font + helpers. */
  fontKey: string;
  font: FontOption;
  fonts: FontOption[];
  setFont: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  toggleColorMode: () => {},
  schemeKey: DEFAULT_SCHEME_KEY,
  scheme: getScheme(DEFAULT_SCHEME_KEY),
  setScheme: () => {},
  customInput: null,
  setCustom: () => {},
  fontKey: DEFAULT_FONT_KEY,
  font: getFont(DEFAULT_FONT_KEY),
  fonts: FONTS,
  setFont: () => {},
});

/** Back-compat: existing code only used this for the dark-mode toggle. */
export const useColorMode = () => {
  const { toggleColorMode } = useContext(ThemeContext);
  return { toggleColorMode };
};

/** Full theme context (mode + active color scheme + custom palette). */
export const useAppTheme = () => useContext(ThemeContext);

function setCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function persistKey(key: string) {
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
  setCookie(SCHEME_COOKIE, key);
}

function persistCustom(input: CustomSchemeInput) {
  const json = JSON.stringify(input);
  try {
    localStorage.setItem(SCHEME_CUSTOM_STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
  setCookie(SCHEME_CUSTOM_COOKIE, encodeURIComponent(json));
}

function persistFont(key: string) {
  try {
    localStorage.setItem(FONT_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
  setCookie(FONT_COOKIE, key);
}

export default function ClientThemeWrapper({
  children,
  initialScheme = DEFAULT_SCHEME_KEY,
  initialMode = "light",
  initialCustom = null,
  initialFont = DEFAULT_FONT_KEY,
}: {
  children: React.ReactNode;
  initialScheme?: string;
  initialMode?: PaletteMode;
  initialCustom?: CustomSchemeInput | null;
  initialFont?: string;
}) {
  const [mode, setMode] = useState<PaletteMode>(initialMode);
  const [schemeKey, setSchemeKey] = useState<string>(initialScheme);
  const [customInput, setCustomInput] = useState<CustomSchemeInput | null>(initialCustom);
  const [fontKey, setFontKey] = useState<string>(() => getFont(initialFont).key);

  const toggleColorMode = useCallback(() => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setScheme = useCallback((key: string) => {
    const safe = key === CUSTOM_SCHEME_KEY ? CUSTOM_SCHEME_KEY : getScheme(key).key;
    setSchemeKey(safe);
    persistKey(safe);
  }, []);

  const setCustom = useCallback((input: CustomSchemeInput) => {
    setCustomInput(input);
    setSchemeKey(CUSTOM_SCHEME_KEY);
    persistKey(CUSTOM_SCHEME_KEY);
    persistCustom(input);
  }, []);

  const setFont = useCallback((key: string) => {
    const safe = getFont(key).key;
    setFontKey(safe);
    persistFont(safe);
  }, []);

  // Keep CSS custom properties (shadcn tokens + --app-* tokens) in sync.
  useEffect(() => {
    applyScheme(schemeKey, mode, customInput);
  }, [schemeKey, mode, customInput]);

  // Keep the global font CSS var in sync (drives body + non-MUI text; MUI uses
  // the theme typography). Covers every subsequent change after SSR.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-font", getFont(fontKey).family);
    document.documentElement.setAttribute("data-font", fontKey);
  }, [fontKey]);

  // Reconcile with the GLOBAL scheme stored on the backend so every user/role
  // picks up the admin's choice (incl. a custom palette). Failures are ignored.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const company = await coreService.getCurrentCompany();
        if (cancelled) return;
        const remoteKey = company?.active_color_scheme;
        const remoteCustom = company?.custom_color_scheme as CustomSchemeInput | null | undefined;
        if (remoteKey === CUSTOM_SCHEME_KEY && remoteCustom) {
          setCustomInput(remoteCustom);
          setSchemeKey(CUSTOM_SCHEME_KEY);
          persistKey(CUSTOM_SCHEME_KEY);
          persistCustom(remoteCustom);
        } else if (remoteKey && getScheme(remoteKey).key === remoteKey && remoteKey !== schemeKey) {
          setSchemeKey(remoteKey);
          persistKey(remoteKey);
        }
        const remoteFont = company?.active_font;
        if (remoteFont && getFont(remoteFont).key === remoteFont && remoteFont !== fontKey) {
          setFontKey(remoteFont);
          persistFont(remoteFont);
        }
      } catch {
        /* not logged in / offline — keep local value */
      }
    })();
    return () => {
      cancelled = true;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = useMemo(
    () => getTheme(mode, schemeKey, customInput, fontKey),
    [mode, schemeKey, customInput, fontKey]
  );

  const ctx = useMemo<ThemeContextValue>(
    () => ({
      mode,
      toggleColorMode,
      schemeKey,
      scheme: resolveScheme(schemeKey, customInput),
      setScheme,
      customInput,
      setCustom,
      fontKey,
      font: getFont(fontKey),
      fonts: FONTS,
      setFont,
    }),
    [mode, toggleColorMode, schemeKey, customInput, setScheme, setCustom, fontKey, setFont]
  );

  return (
    <ThemeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
