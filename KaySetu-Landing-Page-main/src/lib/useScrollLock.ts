"use client";

import { useEffect } from "react";

/**
 * Freezes the page behind an overlay (auth modal, nav flyout).
 *
 * The lock has to land on <html>, not <body>: globals.css puts `overflow-x: clip`
 * on the root, so the root is no longer `overflow: visible` and body's overflow
 * never propagates to the viewport — `body { overflow: hidden }` scrolls on
 * regardless. The root *is* the scrollport, so hiding its overflow-y stops it
 * while keeping the current scroll offset (and every `position: sticky`) intact.
 *
 * Ref-counted, because the nav flyout and the modal can both ask for a lock and
 * whichever unmounts first must not release the other's.
 */
let locks = 0;
let release: (() => void) | null = null;

function lockScroll() {
  const root = document.documentElement;
  const prevOverflowY = root.style.overflowY;
  const prevPaddingRight = root.style.paddingRight;

  // Measure across the change: `scrollbar-gutter: stable` already reserves the
  // gutter on modern browsers, so the delta is 0 there and we add nothing.
  // Where it isn't supported the scrollbar vanishes and we backfill its width.
  const widthBefore = root.clientWidth;
  root.style.overflowY = "hidden";
  const gutter = root.clientWidth - widthBefore;

  if (gutter > 0) {
    const basePadding = parseFloat(getComputedStyle(root).paddingRight) || 0;
    root.style.paddingRight = `${basePadding + gutter}px`;
  }

  release = () => {
    root.style.overflowY = prevOverflowY;
    root.style.paddingRight = prevPaddingRight;
  };
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    if (locks++ === 0) lockScroll();

    return () => {
      if (--locks === 0) {
        release?.();
        release = null;
      }
    };
  }, [locked]);
}
