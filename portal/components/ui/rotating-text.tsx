"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Transition, Variant } from "framer-motion";

type StaggerFrom = "first" | "last" | "center" | "random" | number;
type SplitBy = "characters" | "words" | "lines";

interface WordElement {
    characters: string[];
    needsSpace: boolean;
}

interface RotatingTextProps {
    texts: string[];
    transition?: Transition;
    initial?: any;
    animate?: any;
    exit?: any;
    animatePresenceMode?: "sync" | "wait" | "popLayout";
    animatePresenceInitial?: boolean;
    rotationInterval?: number;
    staggerDuration?: number;
    staggerFrom?: StaggerFrom;
    loop?: boolean;
    auto?: boolean;
    splitBy?: SplitBy;
    onNext?: (index: number) => void;
    mainClassName?: string;
    splitLevelClassName?: string;
    elementLevelClassName?: string;
}

const cn = (...classes: (string | undefined | null | boolean)[]): string => {
    return classes.filter(Boolean).join(" ");
};

export const RotatingText = React.forwardRef<HTMLSpanElement, RotatingTextProps>(
    (
        {
            texts,
            transition = { type: "spring", damping: 25, stiffness: 300 },
            initial = { y: "100%", opacity: 0 },
            animate = { y: 0, opacity: 1 },
            exit = { y: "-120%", opacity: 0 },
            animatePresenceMode = "wait",
            animatePresenceInitial = false,
            rotationInterval = 2000,
            staggerDuration = 0,
            staggerFrom = "first",
            loop = true,
            auto = true,
            splitBy = "characters",
            onNext,
            mainClassName,
            splitLevelClassName,
            elementLevelClassName,
            ...rest
        },
        ref
    ) => {
        const [currentTextIndex, setCurrentTextIndex] = useState(0);

        const splitIntoCharacters = (text: string): string[] => {
            if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
                const segmenter = new (Intl as any).Segmenter("en", { granularity: "grapheme" });
                return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
            }
            return Array.from(text);
        };

        const elements: WordElement[] = useMemo(() => {
            const currentText = texts[currentTextIndex];
            if (!currentText) return [];

            if (splitBy === "characters") {
                const words = currentText.split(" ");
                return words.map((word, i) => ({
                    characters: splitIntoCharacters(word),
                    needsSpace: i !== words.length - 1,
                }));
            }
            if (splitBy === "words") {
                const words = currentText.split(" ");
                return words.map((word, i) => ({
                    characters: [word],
                    needsSpace: i !== words.length - 1,
                }));
            }
            if (splitBy === "lines") {
                const lines = currentText.split("\n");
                return lines.map((line, i) => ({
                    characters: [line],
                    needsSpace: i !== lines.length - 1,
                }));
            }
            const parts = currentText.split(splitBy);
            return parts.map((part, i) => ({
                characters: [part],
                needsSpace: i !== parts.length - 1,
            }));
        }, [texts, currentTextIndex, splitBy]);

        const getStaggerDelay = useCallback(
            (index: number, totalChars: number): number => {
                switch (staggerFrom) {
                    case "first":
                        return index * staggerDuration;
                    case "last":
                        return (totalChars - 1 - index) * staggerDuration;
                    case "center": {
                        const center = Math.floor(totalChars / 2);
                        return Math.abs(center - index) * staggerDuration;
                    }
                    case "random": {
                        // Static random seed per character loop might be better, 
                        // but for simplicity using the same logic as Vue version
                        return Math.random() * totalChars * staggerDuration;
                    }
                    default:
                        return Math.abs((staggerFrom as number) - index) * staggerDuration;
                }
            },
            [staggerDuration, staggerFrom]
        );

        const handleIndexChange = useCallback(
            (newIndex: number) => {
                setCurrentTextIndex(newIndex);
                onNext?.(newIndex);
            },
            [onNext]
        );

        const next = useCallback(() => {
            const isAtEnd = currentTextIndex === texts.length - 1;
            const nextIndex = isAtEnd ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
            if (nextIndex !== currentTextIndex) {
                handleIndexChange(nextIndex);
            }
        }, [currentTextIndex, texts.length, loop, handleIndexChange]);

        useEffect(() => {
            if (!auto) return;
            const intervalId = setInterval(next, rotationInterval);
            return () => clearInterval(intervalId);
        }, [auto, rotationInterval, next]);

        return (
            <motion.span
                ref={ref}
                className={cn("flex flex-wrap whitespace-pre-wrap relative", mainClassName)}
                {...rest}
                layout
            >
                <span className="sr-only">{texts[currentTextIndex]}</span>

                <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
                    <motion.span
                        key={currentTextIndex}
                        className={cn(
                            splitBy === "lines"
                                ? "flex flex-col w-full"
                                : "flex flex-wrap whitespace-pre-wrap relative"
                        )}
                        aria-hidden="true"
                        layout
                    >
                        {elements.map((wordObj, wordIndex) => {
                            const previousCharsCount = elements
                                .slice(0, wordIndex)
                                .reduce((sum, word) => sum + word.characters.length, 0);
                            const totalChars = elements.reduce((sum, word) => sum + word.characters.length, 0);

                            return (
                                <span key={wordIndex} className={cn("inline-flex", splitLevelClassName)}>
                                    {wordObj.characters.map((char, charIndex) => (
                                        <motion.span
                                            key={charIndex}
                                            initial={initial}
                                            animate={animate}
                                            exit={exit}
                                            transition={{
                                                ...transition,
                                                delay: getStaggerDelay(previousCharsCount + charIndex, totalChars),
                                            }}
                                            className={cn("inline-block", elementLevelClassName)}
                                        >
                                            {char}
                                        </motion.span>
                                    ))}
                                    {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
                                </span>
                            );
                        })}
                    </motion.span>
                </AnimatePresence>
            </motion.span>
        );
    }
);

RotatingText.displayName = "RotatingText";

export default RotatingText;
