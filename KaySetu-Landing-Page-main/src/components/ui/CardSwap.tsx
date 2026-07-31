"use client";

import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import './CardSwap.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  <div ref={ref} {...rest} className={`card ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
));
Card.displayName = 'Card';

const MAX_VISIBLE = 3;

interface Slot {
  x: number;
  y: number;
  z: number;
  opacity: number;
  zIndex: number;
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => {
  const depth = Math.min(i, MAX_VISIBLE);
  return {
    x: depth * distX,
    y: -depth * distY,
    z: -depth * distX * 1.5,
    opacity: i <= MAX_VISIBLE ? 1 : 0,
    zIndex: total - i
  };
};

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    opacity: slot.opacity,
    scale: 1,
    rotation: 0,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true
  });

export interface CardSwapProps {
  width?: number | string;
  height?: number | string;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onCardClick?: (idx: number) => void;
  skewAmount?: number;
  easing?: 'linear' | 'elastic';
  children: React.ReactNode;
  progress?: number;
}

const CardSwap = ({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  children,
  progress
}: CardSwapProps) => {
  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr.length]);

  const container = useRef<HTMLDivElement>(null);
  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i));

  // ---------------------------------------------------------------------
  // Autoplay mode — one self-chaining timeline, never two at once.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (progress !== undefined) return;
    const node = container.current;
    if (!node) return;

    const total = refs.length;
    const elements = refs.map(r => r.current).filter(Boolean) as HTMLDivElement[];

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Every duration/offset below is in seconds and absolute within the timeline,
    // so a paused or interrupted cycle can never leave a card half-placed.
    // Invariant: durFade <= durDrop. The card must be invisible well before the
    // incoming card lands on the same spot (otherwise the two sets of text blur
    // together), but the recycle `set` is anchored to the end of durDrop so the
    // fall is finished writing y/scale before the card jumps to the back.
    const cfg = reduced
      ? {
          lift: 0, durLift: 0, drop: 0, spin: 0, durDrop: 0.3, durFade: 0.3,
          promoteAt: 0.1, durMove: 0.4, stagger: 0.02, durReturn: 0.3, ease: 'power2.out'
        }
      : easing === 'elastic'
        ? {
            lift: 90, durLift: 0.22, drop: 260, spin: 5, durDrop: 0.42, durFade: 0.26,
            promoteAt: 0.26, durMove: 0.8, stagger: 0.07, durReturn: 0.5, ease: 'back.out(1.1)'
          }
        : {
            lift: 55, durLift: 0.18, drop: 240, spin: 3, durDrop: 0.36, durFade: 0.22,
            promoteAt: 0.22, durMove: 0.6, stagger: 0.05, durReturn: 0.42, ease: 'power3.out'
          };

    // Cadence stays whatever the caller asked for; the gap just absorbs the
    // animation so cycles queue instead of colliding.
    const cadence = delay / 1000;

    refs.forEach((r, i) => {
      if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount);
    });

    let tl: gsap.core.Timeline | null = null;
    let nextCall: gsap.core.Tween | null = null;
    let hovered = false;
    let offscreen = false;

    const canRun = () => !hovered && !offscreen;

    function sync() {
      if (canRun()) {
        tl?.play();
        nextCall?.play();
      } else {
        tl?.pause();
        nextCall?.pause();
      }
    }

    function schedule(gap: number) {
      nextCall?.kill();
      nextCall = gsap.delayedCall(gap, runSwap);
      if (!canRun()) nextCall.pause();
    }

    function runSwap() {
      if (total < 2) return;
      const [front, ...rest] = order.current;
      const elFront = refs[front].current;
      if (!elFront) return;
      order.current = [...rest, front];

      const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total);
      const recycleAt = cfg.durLift + cfg.durDrop;

      const timeline = gsap.timeline({
        defaults: { force3D: true, overwrite: 'auto' },
        onComplete: () => schedule(Math.max(0.3, cadence - timeline.duration()))
      });
      tl = timeline;

      // 1. Front card eases toward the viewer, then falls away and fades out.
      timeline
        .to(elFront, { z: cfg.lift, scale: 1.03, duration: cfg.durLift, ease: 'power2.out' }, 0)
        .to(
          elFront,
          { y: cfg.drop, rotation: cfg.spin, scale: 0.94, duration: cfg.durDrop, ease: 'power1.in' },
          cfg.durLift
        )
        .to(elFront, { opacity: 0, duration: cfg.durFade, ease: 'power2.out' }, cfg.durLift);

      // 2. The rest of the deck steps forward one slot, slightly staggered.
      rest.forEach((idx, i) => {
        const el = refs[idx].current;
        if (!el) return;
        const slot = makeSlot(i, cardDistance, verticalDistance, total);
        const at = cfg.promoteAt + Math.min(i, MAX_VISIBLE) * cfg.stagger;
        timeline.set(el, { zIndex: slot.zIndex }, at);
        timeline.to(
          el,
          { x: slot.x, y: slot.y, z: slot.z, opacity: slot.opacity, duration: cfg.durMove, ease: cfg.ease },
          at
        );
      });

      // 3. Once invisible, the dropped card is teleported to the back of the
      //    deck and eases in — no visible jump, no relative-value drift.
      timeline.set(
        elFront,
        {
          zIndex: backSlot.zIndex,
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z - 60,
          rotation: 0,
          scale: 0.9,
          opacity: 0
        },
        recycleAt
      );
      timeline.to(
        elFront,
        { z: backSlot.z, scale: 1, opacity: backSlot.opacity, duration: cfg.durReturn, ease: 'power2.out' },
        recycleAt
      );
    }

    schedule(cadence);

    // Don't animate what nobody is looking at — avoids the catch-up lurch when
    // the section scrolls back into view or the tab regains focus.
    const io = new IntersectionObserver(
      ([entry]) => {
        offscreen = !entry.isIntersecting;
        sync();
      },
      { threshold: 0 }
    );
    io.observe(node);

    const onVisibility = () => {
      offscreen = document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onEnter = () => {
      hovered = true;
      sync();
    };
    const onLeave = () => {
      hovered = false;
      sync();
    };
    if (pauseOnHover) {
      node.addEventListener('mouseenter', onEnter);
      node.addEventListener('mouseleave', onLeave);
    }

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      node.removeEventListener('mouseenter', onEnter);
      node.removeEventListener('mouseleave', onLeave);
      nextCall?.kill();
      tl?.kill();
      gsap.killTweensOf(elements);
    };
  }, [progress, cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs]);

  // ---------------------------------------------------------------------
  // Controlled mode — scroll-driven, interpolated from a float progress.
  // quickTo setters are reused so a scroll frame retargets the existing
  // tween instead of allocating a new one per card per frame.
  // ---------------------------------------------------------------------
  const setters = useRef<Record<string, (v: number) => void>[]>([]);

  useEffect(() => {
    if (progress === undefined) return;
    setters.current = refs.map(ref => {
      const el = ref.current;
      if (!el) return {} as Record<string, (v: number) => void>;
      gsap.set(el, {
        xPercent: -50,
        yPercent: -50,
        skewY: skewAmount,
        transformOrigin: 'center center',
        force3D: true
      });
      const opts = { duration: 0.55, ease: 'power3.out' } as const;
      return {
        x: gsap.quickTo(el, 'x', opts),
        y: gsap.quickTo(el, 'y', opts),
        z: gsap.quickTo(el, 'z', opts),
        opacity: gsap.quickTo(el, 'opacity', opts)
      };
    });
    return () => {
      refs.forEach(ref => ref.current && gsap.killTweensOf(ref.current));
    };
  }, [progress === undefined, refs, skewAmount]);

  useEffect(() => {
    if (progress === undefined) return;

    refs.forEach((ref, i) => {
      const el = ref.current;
      const set = setters.current[i];
      if (!el || !set?.x) return;

      const d = i - progress;

      let x = 0;
      let y = 0;
      let z = 0;
      let opacity = 1;
      // The front card sits at 1000 and each slot behind it steps down, leaving
      // the whole 0-999 band free for cards that have already dropped.
      let zIndex = 1000 - Math.round(Math.max(d, 0) * 10);

      if (d < 0) {
        // Dropping away. The container is `preserve-3d`, so paint order comes
        // from translateZ and NOT from z-index — leaving this card at z:0 put it
        // in front of the incoming card (which sits at a fractional -z while
        // progress is between two indices) and ghosted its text through that
        // card's white background. Park it behind the whole stack instead.
        //
        // It also must not translate: the incoming card is offset from this one
        // by a single slot, so any y-drop slides a strip of this card's content
        // out from under it and reads as duplicated rows. Receding in z alone
        // reads as the card sinking into the deck — perspective shrinks it as
        // it fades.
        const dropProgress = -d;
        z = -(MAX_VISIBLE + 1) * cardDistance * 1.5;
        opacity = Math.max(0, 1 - dropProgress * 2.5);
        zIndex = i; // tie-break among dropped cards only
      } else {
        // In the stack
        const visualIndex = Math.min(d, MAX_VISIBLE);
        x = visualIndex * cardDistance;
        y = -visualIndex * verticalDistance;
        z = -visualIndex * cardDistance * 1.5;

        // Fade out slightly if it's the last visible one pushing out
        if (d > MAX_VISIBLE - 1) {
          opacity = Math.max(0, 1 - (d - (MAX_VISIBLE - 1)));
        }
      }

      gsap.set(el, { zIndex });
      set.x(x);
      set.y(y);
      set.z(z);
      set.opacity(opacity);
    });
  }, [progress, refs, cardDistance, verticalDistance]);

  const rendered = childArr.map((child, i) => {
    if (!isValidElement(child)) return child;
    const el = child as React.ReactElement<any>;
    return cloneElement(el, {
      key: i,
      ref: refs[i],
      style: { width, height, ...(el.props.style ?? {}) },
      onClick: (e: any) => {
        el.props.onClick?.(e);
        onCardClick?.(i);
      }
    });
  });

  return (
    <div ref={container} className="card-swap-container" style={{ width, height }}>
      {rendered}
    </div>
  );
};

export default CardSwap;
