"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { lookupIcon } from "./iconMap";
import { LOCAL_LUCIDE } from "./localIcons";

type MuiFontSize = "inherit" | "small" | "medium" | "large";
type MuiColor =
  | "inherit"
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "info"
  | "warning"
  | "action"
  | "disabled"
  | (string & {});

export interface AppIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  /** @mui/icons-material component name without the "Icon" suffix, e.g. "Dashboard". */
  name: string;
  /** MUI-style sizing. Mapped to a pixel size for the underlying lucide/animated icon. */
  fontSize?: MuiFontSize;
  /** Explicit pixel size (overrides fontSize). */
  size?: number;
  /** MUI palette token (primary/success/…) or any CSS color. Icon inherits via currentColor. */
  color?: MuiColor;
  sx?: SxProps<Theme>;
}

function parseCssSize(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.endsWith("rem")) return parseFloat(v) * 16;
    if (v.endsWith("px")) return parseFloat(v);
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function sizeFor(fontSize?: MuiFontSize, size?: number): number {
  if (typeof size === "number") return size;
  switch (fontSize) {
    case "small":
      return 20;
    case "large":
      return 32;
    case "inherit":
      return 20;
    case "medium":
    default:
      return 24;
  }
}

function colorFor(theme: Theme, color?: MuiColor): string | undefined {
  if (!color || color === "inherit") return undefined; // inherit ambient currentColor
  switch (color) {
    case "primary":
      return theme.palette.primary.main;
    case "secondary":
      return theme.palette.secondary.main;
    case "success":
      return theme.palette.success.main;
    case "error":
      return theme.palette.error.main;
    case "info":
      return theme.palette.info.main;
    case "warning":
      return theme.palette.warning.main;
    case "action":
      return theme.palette.action.active;
    case "disabled":
      return theme.palette.action.disabled;
    default:
      return color; // raw hex / css color string
  }
}

interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/**
 * Drop-in, scheme-aware, animated icon. Renders the mapped @animateicons (animated)
 * or lucide-react (static) glyph inside an inline-flex span. The glyph uses
 * stroke="currentColor", so it always follows the span's resolved color — which is
 * derived from the active color scheme via the MUI palette.
 *
 * HOVER TRIGGER: animated icons play when the nearest ancestor marked with
 * `data-animate-group` is hovered (e.g. a sidebar nav row or a button), so the
 * whole control animates the icon — not just the tiny icon itself. With no such
 * ancestor it falls back to hovering the icon's own area.
 */
export const AppIcon = React.forwardRef<HTMLSpanElement, AppIconProps>(function AppIcon(
  { name, fontSize, size, color, sx, className, style, onClick, ...rest },
  ref
) {
  const theme = useTheme();
  const entry = lookupIcon(name);
  // Locally-vendored animated icon (lucide-animated) overrides the registry and
  // renders through the normal animated (ref-handle) path.
  const lucideComp = LOCAL_LUCIDE[name];
  const C = lucideComp ?? entry.C;
  const animated = lucideComp ? true : entry.animated;
  const anim = entry.anim;

  const spanRef = React.useRef<HTMLSpanElement | null>(null);
  const iconRef = React.useRef<IconHandle | null>(null);

  const setSpanRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      spanRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
    },
    [ref]
  );

  React.useEffect(() => {
    const span = spanRef.current;
    if (!span) return;
    // Animate when the whole interactive control is hovered: an explicit
    // [data-animate-group], else the nearest button/link/menu-item, else the
    // icon's own area as a last resort.
    const group =
      (span.closest("[data-animate-group]") as HTMLElement | null) ??
      (span.closest(
        "button, a[href], [role='button'], [role='menuitem'], [role='tab'], .MuiButtonBase-root"
      ) as HTMLElement | null) ??
      span;
    // Animated (@animateicons / lucide-animated) icons play via their ref handle;
    // static (lucide) icons play a CSS micro-animation toggled by `is-anim`.
    const enter = animated
      ? () => iconRef.current?.startAnimation()
      : () => span.classList.add("is-anim");
    const leave = animated
      ? () => iconRef.current?.stopAnimation()
      : () => span.classList.remove("is-anim");
    group.addEventListener("mouseenter", enter);
    group.addEventListener("mouseleave", leave);
    return () => {
      group.removeEventListener("mouseenter", enter);
      group.removeEventListener("mouseleave", leave);
    };
  }, [animated, name]);

  // Many call sites size icons via sx={{ fontSize }} rather than the fontSize prop.
  const sxObj =
    sx && typeof sx === "object" && !Array.isArray(sx)
      ? (sx as Record<string, unknown>)
      : undefined;
  const sxSize = sxObj ? parseCssSize(sxObj.fontSize) : undefined;
  const px = sizeFor(fontSize, size ?? sxSize);
  const resolved = colorFor(theme, color);

  const AnimatedC = C as unknown as React.ForwardRefExoticComponent<
    { size?: number } & React.RefAttributes<IconHandle>
  >;

  const mergedClassName =
    [!animated ? "app-icon-static" : null, className].filter(Boolean).join(" ") || undefined;

  return (
    <Box
      component="span"
      ref={setSpanRef}
      {...rest}
      className={mergedClassName}
      style={style}
      onClick={onClick}
      data-icon={name}
      data-anim={!animated ? anim : undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
        flexShrink: 0,
        ...(resolved ? { color: resolved } : null),
        ...sx,
      }}
    >
      {animated ? <AnimatedC ref={iconRef} size={px} /> : <C size={px} />}
    </Box>
  );
});

export default AppIcon;
