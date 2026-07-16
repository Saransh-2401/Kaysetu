"use client";

import * as React from "react";

/**
 * Self-contained fallback glyph (currentColor, outline) used by the generated
 * registry for any icon name that isn't mapped to an animated component. Keeps
 * the icon registry free of any npm icon-package dependency.
 */
export default function FallbackIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
