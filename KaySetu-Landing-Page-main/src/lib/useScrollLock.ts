"use client";

import { useEffect } from "react";

/**
 * Freezes the page behind an overlay (auth modal, nav flyout).
 *
 * The lock has to land on <html>, not <body>: globals.css puts `overflow-x: clip`
 * on the root, so the root is no longer `overflow: visible` and body's overflow
 * never propagates to the viewport - `body { overflow: hidden }` scrolls on
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

  // Measure the *layout* width (body's rect) across the change - NOT
  // `clientWidth`. With `scrollbar-gutter: stable` Chrome keeps the gutter
  // reserved under `overflow: hidden` but still reports a 15px-wider
  // clientWidth, so a clientWidth delta double-compensates: the page slid
  // ~7px left on every lock, the nav slid under a stationary cursor, and
  // the hover re-fired - an open/close flap of the flyout. Body's rect
  // tracks the real content box, so the delta is 0 when the gutter holds.
  const widthBefore = document.body.getBoundingClientRect().width;
  root.style.overflowY = "hidden";
  const gutter = document.body.getBoundingClientRect().width - widthBefore;

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
