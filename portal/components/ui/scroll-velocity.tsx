"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

interface VelocityMapping {
    input: [number, number];
    output: [number, number];
}

interface ScrollVelocityProps {
    scrollContainerRef?: React.RefObject<HTMLElement> | null;
    texts?: string[];
    velocity?: number;
    className?: string;
    damping?: number;
    stiffness?: number;
    velocityMapping?: VelocityMapping;
    parallaxClassName?: string;
    scrollerClassName?: string;
    parallaxStyle?: React.CSSProperties;
    scrollerStyle?: React.CSSProperties;
}

export const ScrollVelocity: React.FC<ScrollVelocityProps> = ({
    scrollContainerRef,
    texts = [],
    velocity = 100,
    className = '',
    damping = 50,
    stiffness = 400,
    velocityMapping = { input: [0, 1000], output: [0, 5] },
    parallaxClassName = '',
    scrollerClassName = '',
    parallaxStyle = {},
    scrollerStyle = {}
}) => {
    const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const scrollerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const firstSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);

    const baseX = useRef<number[]>([]);
    const scrollVelocity = useRef(0);
    const smoothVelocity = useRef(0);
    const velocityFactor = useRef(0);
    const directionFactors = useRef<number[]>([]);
    const lastScrollY = useRef(0);
    const lastTime = useRef(0);
    const lastScrollTime = useRef(0);

    const copyWidthsRef = useRef<number[]>([]);
    const [calculatedCopies, setCalculatedCopies] = useState<number[]>([]);

    const wrap = (min: number, max: number, v: number): number => {
        const range = max - min;
        if (range === 0) return min;
        const mod = (((v - min) % range) + range) % range;
        return mod + min;
    };

    const updateWidths = useCallback(() => {
        const newCopyWidths: number[] = [];
        const newCalculatedCopies: number[] = [];

        texts.forEach((_, index) => {
            const firstSpan = firstSpanRefs.current[index];
            const container = containerRefs.current[index];

            if (firstSpan && container) {
                const singleCopyWidth = firstSpan.getBoundingClientRect().width;
                if (singleCopyWidth <= 0) return;
                const viewportWidth = window.innerWidth;
                const minCopies = Math.ceil((viewportWidth * 3) / singleCopyWidth);
                const optimalCopies = Math.max(minCopies, 10);

                newCopyWidths[index] = singleCopyWidth;
                newCalculatedCopies[index] = optimalCopies;
            }
        });

        if (newCopyWidths.length === texts.length) {
            copyWidthsRef.current = newCopyWidths;
            setCalculatedCopies(newCalculatedCopies);
        } else if (newCopyWidths.length > 0) {
            // Partial update fallback
            newCopyWidths.forEach((w, i) => { if (w) copyWidthsRef.current[i] = w; });
            newCalculatedCopies.forEach((c, i) => {
                if (c) {
                    setCalculatedCopies(prev => {
                        const next = [...prev];
                        next[i] = c;
                        return next;
                    });
                }
            });
        }
    }, [texts]);

    useEffect(() => {
        if (baseX.current.length === 0) {
            baseX.current = new Array(texts.length).fill(0);
        }
        if (directionFactors.current.length === 0) {
            directionFactors.current = new Array(texts.length).fill(1);
        }

        lastTime.current = performance.now();

        const onTick = () => {
            const currentTime = performance.now();
            if (lastTime.current === 0) {
                lastTime.current = currentTime;
                return;
            }
            const delta = currentTime - lastTime.current;
            lastTime.current = currentTime;

            // 1. Update smooth velocity
            const df = damping / 1000;
            const sf = stiffness / 1000;
            const velocityDiff = scrollVelocity.current - smoothVelocity.current;
            smoothVelocity.current += velocityDiff * sf;
            smoothVelocity.current *= (1 - df);

            // 2. Update velocity factor
            const { input, output } = velocityMapping;
            const inputRange = input[1] - input[0];
            const outputRange = output[1] - output[0];
            let normalizedVelocity = (Math.abs(smoothVelocity.current) - input[0]) / inputRange;
            normalizedVelocity = Math.max(0, Math.min(1, normalizedVelocity));
            velocityFactor.current = output[0] + normalizedVelocity * outputRange;
            if (smoothVelocity.current < 0) velocityFactor.current *= -1;

            // 3. Animate each line
            texts.forEach((_, index) => {
                const scroller = scrollerRefs.current[index];
                const singleWidth = copyWidthsRef.current[index];
                if (!scroller || !singleWidth) return;

                const baseVelocity = index % 2 !== 0 ? -velocity : velocity;

                if (velocityFactor.current < 0) {
                    directionFactors.current[index] = -1;
                } else if (velocityFactor.current > 0) {
                    directionFactors.current[index] = 1;
                }

                let moveBy = (directionFactors.current[index] || 1) * baseVelocity * (delta / 1000);
                moveBy += (directionFactors.current[index] || 1) * moveBy * velocityFactor.current;

                baseX.current[index] += moveBy;

                const x = wrap(-singleWidth, 0, baseX.current[index]);
                gsap.set(scroller, {
                    x,
                    force3D: true,
                    willChange: 'transform'
                });
            });
        };

        gsap.ticker.add(onTick);

        return () => {
            gsap.ticker.remove(onTick);
        };
    }, [texts, velocity, damping, stiffness, velocityMapping]);

    useEffect(() => {
        lastScrollY.current = window.scrollY;
        lastScrollTime.current = performance.now();

        // Immediate measurement
        updateWidths();
        const timer = setTimeout(updateWidths, 100);
        const timer2 = setTimeout(updateWidths, 1000); // Safety re-check for late fonts

        window.addEventListener('resize', updateWidths);

        const updateScrollVelocity = () => {
            const currentScrollY = scrollContainerRef?.current
                ? scrollContainerRef.current.scrollTop
                : window.scrollY;

            const currentTime = performance.now();
            const timeDelta = currentTime - lastScrollTime.current;

            if (timeDelta > 0) {
                const scrollDelta = currentScrollY - lastScrollY.current;
                scrollVelocity.current = (scrollDelta / timeDelta) * 1000;
                lastScrollY.current = currentScrollY;
                lastScrollTime.current = currentTime;
            }
        };

        const trigger = ScrollTrigger.create({
            trigger: containerRefs.current[0],
            start: 'top bottom',
            end: 'bottom top',
            onUpdate: updateScrollVelocity,
            scroller: scrollContainerRef?.current || window
        });

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateWidths);
            trigger.kill();
        };
    }, [scrollContainerRef, updateWidths]);

    return (
        <section className="bg-[#050505] overflow-hidden py-4 md:py-8 relative">
            {texts.map((text, index) => (
                <div
                    key={index}
                    ref={el => { containerRefs.current[index] = el; }}
                    className={`${parallaxClassName} relative overflow-hidden py-2 group`}
                    style={parallaxStyle}
                >
                    <div
                        ref={el => { scrollerRefs.current[index] = el; }}
                        className={`${scrollerClassName} flex whitespace-nowrap text-center font-black uppercase tracking-tighter text-[2rem] md:text-[4rem] leading-none transition-transform duration-700 ease-out`}
                        style={{
                            ...scrollerStyle,
                        }}
                    >
                        {Array.from({ length: calculatedCopies[index] || 15 }).map((_, spanIndex) => (
                            <span
                                key={spanIndex}
                                ref={spanIndex === 0 ? el => { firstSpanRefs.current[index] = el; } : undefined}
                                className={`shrink-0 px-6 transition-colors duration-500 ${className}`}
                                style={{
                                    color: index % 2 === 0 ? '#FFFFFF' : '#D4AF37',
                                    textShadow: index % 2 === 0
                                        ? '0 0 20px rgba(255,255,255,0.2)'
                                        : '0 0 20px rgba(212,175,55,0.3)',
                                }}
                            >
                                {text}&nbsp;&nbsp;
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
};

export default ScrollVelocity;
