'use client';

import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';

/* Shared expo-out curve - the same one the rest of the site reveals on. */
const EASE = [0.22, 1, 0.36, 1] as const;

type RotatingWordsProps = {
  words: string[];
  /** ms a word stays fully settled before the next one takes over */
  interval?: number;
  className?: string;
};

/* ------------------------------------------------------------------
   RotatingWords - one phrase swaps for the next, letter by letter.

   The old phrase rolls up and out while the new one rolls in from
   below, so the two never sit on top of each other as a double image.
   Only `opacity` and `transform` animate (no filters, no layout), so
   the whole swap runs on the compositor at a steady 60fps.

   Width is reserved by an invisible copy of the longest phrase, which
   means the centred headline above it never reflows mid-roll.
------------------------------------------------------------------ */
export function RotatingWords({
  words,
  interval = 3200,
  className = '',
}: RotatingWordsProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      interval,
    );
    return () => clearInterval(id);
  }, [words.length, interval]);

  const word = words[index] ?? '';
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');

  // Reduced motion keeps the sequencing but drops every transform, so the
  // phrase cross-dissolves in place instead of travelling.
  // `delayChildren` holds the incoming phrase back until the outgoing one is
  // essentially gone. Without it the two cascades overlap and the line reads
  // as half of one phrase spliced onto half of the other.
  const group: Variants = {
    hidden: {},
    show: {
      transition: reduced
        ? { staggerChildren: 0.01, delayChildren: 0.26 }
        : { staggerChildren: 0.021, delayChildren: 0.4 },
    },
    exit: {
      transition: { staggerChildren: reduced ? 0.007 : 0.014 },
    },
  };

  const letter: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.3, ease: 'linear' } },
        exit: { opacity: 0, transition: { duration: 0.22, ease: 'linear' } },
      }
    : {
        // Rotating about the letter's own centre with a short perspective
        // gives the roll depth without the skew a shared parent perspective
        // would throw on the letters furthest from the middle.
        hidden: {
          opacity: 0,
          y: '0.4em',
          rotateX: -78,
          transformPerspective: 520,
        },
        show: {
          opacity: 1,
          y: '0em',
          rotateX: 0,
          transformPerspective: 520,
          transition: { duration: 0.52, ease: EASE },
        },
        exit: {
          opacity: 0,
          y: '-0.4em',
          rotateX: 78,
          transformPerspective: 520,
          transition: { duration: 0.3, ease: [0.5, 0, 0.75, 0] as const },
        },
      };

  return (
    <span className={`relative inline-block text-left align-top ${className}`}>
      {/* Width/height reservation - never painted, never read aloud. */}
      <span aria-hidden className="invisible block whitespace-nowrap">
        {longest}
      </span>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          variants={group}
          initial="hidden"
          animate="show"
          exit="exit"
          className="absolute inset-0 block whitespace-nowrap text-center"
          aria-hidden
        >
          {[...word].map((char, i) => (
            <motion.span
              key={`${index}-${i}`}
              variants={letter}
              className="inline-block will-change-[transform,opacity]"
            >
              {char === ' ' ? ' ' : char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>

      {/* One live region for screen readers instead of 17 split letters. */}
      <span className="sr-only">{word}</span>
    </span>
  );
}
