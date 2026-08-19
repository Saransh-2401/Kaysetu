"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A screen in the carousel. `src` renders an image; `content` renders live JSX
 * inside the phone frame instead - which is what the KaySetu screens use, since
 * there are no app screenshots in /public to point at.
 */
export type ImageItem = {
  alt: string;
  src?: string;
  content?: React.ReactNode;
};

type PhoneCarouselProps = {
  images: ImageItem[];
  className?: string;
  /** Milliseconds between auto-advances. Pass 0 to disable. */
  autoPlayMs?: number;
};

/** How far off-centre each neighbour sits, how small it gets, how far it turns. */
const FAN = [
  { x: 0, scale: 1, rotate: 0, z: 30, opacity: 1 },
  { x: 80, scale: 0.84, rotate: 18, z: 20, opacity: 1 },
  { x: 142, scale: 0.68, rotate: 24, z: 10, opacity: 0.5 },
];

/* On phones the full fan is wider than the viewport, so the side screens get
   sliced off at the section edge. This tighter fan (closer, smaller
   neighbours) keeps the whole spread inside a 375px screen. */
const FAN_COMPACT = [
  { x: 0, scale: 1, rotate: 0, z: 30, opacity: 1 },
  { x: 56, scale: 0.64, rotate: 22, z: 20, opacity: 0.9 },
  { x: 96, scale: 0.5, rotate: 26, z: 10, opacity: 0.4 },
];

/** True below Tailwind's `sm` breakpoint; false during SSR (desktop-first). */
function useCompact() {
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return compact;
}

export function PhoneCarousel({
  images,
  className,
  autoPlayMs = 4000,
}: PhoneCarouselProps) {
  const count = images.length;
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const compact = useCompact();
  const fanSet = compact ? FAN_COMPACT : FAN;

  const go = React.useCallback(
    (dir: number) => setActive((i) => (i + dir + count) % count),
    [count],
  );

  React.useEffect(() => {
    if (!autoPlayMs || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const root = rootRef.current;
      // Hover/focus pausing is read at tick time instead of tracked in state:
      // clicking a side phone promotes it to active, which unmounts the very
      // overlay button that holds focus, so no blur ever fires and a `paused`
      // flag would latch on forever and stop the loop dead.
      if (root && (root.matches(":hover") || root.contains(document.activeElement))) return;
      go(1);
    }, autoPlayMs);
    return () => window.clearInterval(id);
  }, [autoPlayMs, count, go]);

  // Shortest signed distance around the ring, so wrapping from the last screen
  // to the first slides one step forward instead of whipping back through all
  // the others.
  const offsetOf = (i: number) => {
    let d = i - active;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  };

  // With an even, small ring the item directly opposite the active one is
  // equidistant both ways and lands on a single side, which reads as a lopsided
  // fan. Under five screens, show one neighbour each side and park the rest.
  const maxDepth = count >= 5 ? 2 : 1;

  return (
    <div
      ref={rootRef}
      className={cn("w-full select-none", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label="App screens"
    >
      <div
        className="relative h-[400px] xs:h-[440px] sm:h-[620px] lg:h-[660px] [perspective:1800px]"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        }}
      >
        {images.map((item, i) => {
          const offset = offsetOf(i);
          const depth = Math.abs(offset);
          const fan = fanSet[Math.min(depth, maxDepth)];
          const dir = Math.sign(offset);
          const isActive = offset === 0;

          return (
            <div
              key={item.src ?? item.alt}
              aria-hidden={!isActive}
              // The whole transform lives inline: Tailwind v4 compiles
              // -translate-x-1/2 to the native `translate` property, which would
              // stack on top of this instead of being replaced by it.
              style={{
                transform: `translate(-50%, -50%) translateX(${dir * fan.x}%) scale(${fan.scale}) rotateY(${-dir * fan.rotate}deg)`,
                zIndex: fan.z,
                opacity: depth > maxDepth ? 0 : fan.opacity,
                pointerEvents: depth > maxDepth ? "none" : undefined,
              }}
              className="absolute left-1/2 top-1/2 w-[176px] xs:w-[196px] sm:w-[280px] lg:w-[296px] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d]"
            >
              <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2.2rem] border-[7px] border-slate-900 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.18)] sm:rounded-[2.5rem] sm:border-[8px]">
                {/* notch */}
                <div className="absolute inset-x-0 top-0 z-30 mx-11 h-4 rounded-b-2xl bg-slate-900 sm:mx-14 sm:h-6 sm:rounded-b-3xl" />
                {item.content ? (
                  <div className="h-full w-full overflow-hidden">{item.content}</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>

              {!isActive && depth <= maxDepth ? (
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className="absolute inset-0 z-40 cursor-pointer rounded-[2.5rem]"
                >
                  <span className="sr-only">Show {item.alt}</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
