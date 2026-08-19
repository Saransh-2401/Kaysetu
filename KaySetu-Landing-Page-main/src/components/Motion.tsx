"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------
   Reveal - fade/slide up when scrolled into view (staggerable)
------------------------------------------------------------------ */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------
   WordReveal - masked, word-by-word slide-up. Plays on mount (for
   above-the-fold hero) or when scrolled into view (whenVisible).
   Each word rides up from behind a clip so the entrance reads as a
   smooth cascade rather than a single block fade.
------------------------------------------------------------------ */
export function WordReveal({
  text,
  as: Tag = "span",
  className = "",
  wordClassName = "",
  delay = 0,
  stagger = 55,
  whenVisible = false,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  whenVisible?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [play, setPlay] = useState(!whenVisible);

  useEffect(() => {
    if (!whenVisible) {
      // Kick off on the next frame so the initial (hidden) state paints
      // first - avoids a flash of already-revealed text.
      const id = requestAnimationFrame(() => setPlay(true));
      return () => cancelAnimationFrame(id);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [whenVisible]);

  const words = text.split(" ");

  return (
    <Tag ref={ref} className={`word-reveal ${play ? "is-in" : ""} ${className}`}>
      {words.map((word, i) => (
        // The inter-word space must sit BETWEEN the masks, not inside one - 
        // a trailing space inside an overflow-hidden inline-block is trimmed,
        // which would collide adjacent words on the same line.
        <Fragment key={`${word}-${i}`}>
          <span className="word-reveal-mask">
            <span
              className={`word-reveal-word ${wordClassName}`}
              style={{ transitionDelay: `${delay + i * stagger}ms` }}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/* ------------------------------------------------------------------
   Counter - animate a number from 0 → value on scroll into view
------------------------------------------------------------------ */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1600,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let start = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const step = (t: number) => {
          if (!start) start = t;
          const p = Math.min((t - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(value * eased);
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  const formatted = display.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------
   Marquee - seamless infinite horizontal strip (pauses on hover)
------------------------------------------------------------------ */
export function Marquee({
  children,
  duration = 32,
  reverse = false,
  className = "",
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`group marquee-mask overflow-hidden ${className}`}>
      <div
        className="marquee-track"
        style={{
          ["--marquee-duration" as string]: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   AutoMedia - plays a muted looping video when in view, pauses when
   out. Falls back to a coded mockup (children) if no src / on error.
------------------------------------------------------------------ */
export function AutoMedia({
  src,
  poster,
  children,
  className = "",
}: {
  src?: string;
  poster?: string;
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || failed) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, failed]);

  if (!src || failed) {
    return <div className={className}>{children}</div>;
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}
