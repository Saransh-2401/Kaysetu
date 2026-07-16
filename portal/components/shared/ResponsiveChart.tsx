"use client";
/**
 * Drop-in replacement for recharts' <ResponsiveContainer>.
 *
 * recharts v3's ResponsiveContainer logs, on its FIRST internal render, once
 * per chart:
 *   "The width(-1) and height(-1) of chart should be greater than 0 ..."
 * whenever it is given percentage dimensions (width/height = "100%"): it renders
 * once with its size state still initialised to -1 (before its ResizeObserver
 * fires) and warns. Gating when the container *mounts* doesn't help — recharts
 * still does that first -1 render.
 *
 * This wrapper measures its own box and passes recharts a NUMERIC pixel size, so
 * recharts' initial size state is already valid (never -1) and it never warns.
 * A ResizeObserver keeps the size in sync, so it stays fully responsive. The API
 * matches ResponsiveContainer, so it's aliased in as `ResponsiveContainer` at the
 * import site and no JSX changes.
 */
import React, { useEffect, useRef, useState } from "react";
import { ResponsiveContainer as RC } from "recharts";

type RCProps = React.ComponentProps<typeof RC>;

export function ResponsiveChart({
  children,
  width = "100%",
  height = "100%",
  minHeight,
  minWidth,
  ...rest
}: RCProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size.w > 0 && size.h > 0;

  return (
    <div
      ref={ref}
      style={{
        width: width as React.CSSProperties["width"],
        height: height as React.CSSProperties["height"],
        minHeight: minHeight as React.CSSProperties["minHeight"],
        minWidth: minWidth as React.CSSProperties["minWidth"],
      }}
    >
      {ready ? (
        // Numeric size => recharts' initial state is valid, so it never warns.
        <RC width={size.w} height={size.h} {...rest}>
          {children as React.ReactElement}
        </RC>
      ) : null}
    </div>
  );
}

export default ResponsiveChart;
