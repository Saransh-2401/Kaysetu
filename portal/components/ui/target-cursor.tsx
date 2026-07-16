"use client";

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface TargetCursorProps {
    targetSelector?: string;
    spinDuration?: number;
    hideDefaultCursor?: boolean;
}

export const TargetCursor: React.FC<TargetCursorProps> = ({
    targetSelector = ".cursor-target, button, a, .MuiButton-root, [role='button']",
    spinDuration = 2,
    hideDefaultCursor = true,
}) => {
    const cursorRef = useRef<HTMLDivElement>(null);
    const cornersRef = useRef<HTMLDivElement[]>([]);
    const spinTl = useRef<gsap.core.Timeline | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const isTouch = window.matchMedia("(pointer: coarse)").matches ||
                ('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0);
            setIsMobile(isTouch);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const constants = {
        borderWidth: 3,
        cornerSize: 12,
        parallaxStrength: 0.00005,
    };

    useEffect(() => {
        if (!cursorRef.current || isMobile) return;

        const originalCursor = document.body.style.cursor;
        if (hideDefaultCursor) {
            document.body.classList.add('no-cursor');
        }

        const cursor = cursorRef.current;

        let activeTarget: Element | null = null;
        let currentTargetMove: ((ev: Event) => void) | null = null;
        let currentLeaveHandler: (() => void) | null = null;
        let isAnimatingToTarget = false;
        let resumeTimeout: ReturnType<typeof setTimeout> | null = null;

        const cleanupTarget = (target: Element) => {
            if (currentTargetMove) {
                target.removeEventListener('mousemove', currentTargetMove);
            }
            if (currentLeaveHandler) {
                target.removeEventListener('mouseleave', currentLeaveHandler);
            }
            currentTargetMove = null;
            currentLeaveHandler = null;
        };

        gsap.set(cursor, {
            xPercent: -50,
            yPercent: -50,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            opacity: 1,
            display: 'block',
        });

        const createSpinTimeline = () => {
            if (spinTl.current) {
                spinTl.current.kill();
            }
            spinTl.current = gsap.timeline({ repeat: -1 }).to(cursor, {
                rotation: '+=360',
                duration: spinDuration,
                ease: 'none',
            });
        };

        createSpinTimeline();

        const moveCursor = (x: number, y: number) => {
            gsap.to(cursor, {
                x,
                y,
                duration: 0.1,
                ease: 'power3.out',
            });
        };

        const moveHandler = (e: MouseEvent) => moveCursor(e.clientX, e.clientY);
        window.addEventListener('mousemove', moveHandler);

        const enterHandler = (e: MouseEvent) => {
            const directTarget = e.target as Element;

            const allTargets: Element[] = [];
            let current: Element | null = directTarget;
            while (current && current !== document.body) {
                if (current.matches(targetSelector)) {
                    allTargets.push(current);
                }
                current = current.parentElement;
            }

            const target = allTargets[0] || null;
            if (!target || !cursorRef.current || cornersRef.current.length === 0) return;

            if (activeTarget === target) return;

            if (activeTarget) {
                cleanupTarget(activeTarget);
            }

            if (resumeTimeout) {
                clearTimeout(resumeTimeout);
                resumeTimeout = null;
            }

            activeTarget = target;
            cornersRef.current.forEach(corner => {
                gsap.killTweensOf(corner);
            });
            gsap.killTweensOf(cursorRef.current, 'rotation');
            spinTl.current?.pause();

            gsap.set(cursorRef.current, { rotation: 0 });

            const updateCorners = (mouseX?: number, mouseY?: number) => {
                if (!cursorRef.current) return;
                const rect = target.getBoundingClientRect();
                const cursorRect = cursorRef.current.getBoundingClientRect();

                const cursorCenterX = cursorRect.left + cursorRect.width / 2;
                const cursorCenterY = cursorRect.top + cursorRect.height / 2;

                const [tlc, trc, brc, blc] = cornersRef.current;

                const { borderWidth, cornerSize, parallaxStrength } = constants;

                const tlOffset = {
                    x: rect.left - cursorCenterX - borderWidth,
                    y: rect.top - cursorCenterY - borderWidth,
                };
                const trOffset = {
                    x: rect.right - cursorCenterX + borderWidth - cornerSize,
                    y: rect.top - cursorCenterY - borderWidth,
                };
                const brOffset = {
                    x: rect.right - cursorCenterX + borderWidth - cornerSize,
                    y: rect.bottom - cursorCenterY + borderWidth - cornerSize,
                };
                const blOffset = {
                    x: rect.left - cursorCenterX - borderWidth,
                    y: rect.bottom - cursorCenterY + borderWidth - cornerSize,
                };

                if (mouseX !== undefined && mouseY !== undefined) {
                    const targetCenterX = rect.left + rect.width / 2;
                    const targetCenterY = rect.top + rect.height / 2;
                    const mouseOffsetX = (mouseX - targetCenterX) * parallaxStrength;
                    const mouseOffsetY = (mouseY - targetCenterY) * parallaxStrength;

                    tlOffset.x += mouseOffsetX;
                    tlOffset.y += mouseOffsetY;
                    trOffset.x += mouseOffsetX;
                    trOffset.y += mouseOffsetY;
                    brOffset.x += mouseOffsetX;
                    brOffset.y += mouseOffsetY;
                    blOffset.x += mouseOffsetX;
                    blOffset.y += mouseOffsetY;
                }

                const tl = gsap.timeline();
                const corners = [tlc, trc, brc, blc];
                const offsets = [tlOffset, trOffset, brOffset, blOffset];

                corners.forEach((corner, index) => {
                    const offset = offsets[index];
                    if (!offset || !corner) return;
                    tl.to(
                        corner as HTMLElement,
                        {
                            x: offset.x,
                            y: offset.y,
                            duration: 0.2,
                            ease: 'power2.out',
                        },
                        0
                    );
                });
            };

            isAnimatingToTarget = true;
            updateCorners();

            setTimeout(() => {
                isAnimatingToTarget = false;
            }, 1);

            let moveThrottle: number | null = null;
            const targetMove = (ev: Event) => {
                if (moveThrottle || isAnimatingToTarget) return;
                moveThrottle = requestAnimationFrame(() => {
                    const mouseEvent = ev as MouseEvent;
                    updateCorners(mouseEvent.clientX, mouseEvent.clientY);
                    moveThrottle = null;
                });
            };

            const leaveHandler = () => {
                activeTarget = null;
                isAnimatingToTarget = false;

                const corners = cornersRef.current;
                gsap.killTweensOf(corners);

                const { cornerSize } = constants;
                const positions = [
                    { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
                    { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
                    { x: cornerSize * 0.5, y: cornerSize * 0.5 },
                    { x: -cornerSize * 1.5, y: cornerSize * 0.5 },
                ];

                const tl = gsap.timeline();
                corners.forEach((corner, index) => {
                    const pos = positions[index];
                    if (!pos || !corner) return;
                    tl.to(
                        corner as HTMLElement,
                        {
                            x: pos.x,
                            y: pos.y,
                            duration: 0.3,
                            ease: 'power3.out',
                        },
                        0
                    );
                });

                resumeTimeout = setTimeout(() => {
                    if (!activeTarget && cursorRef.current && spinTl.current) {
                        const currentRotation = gsap.getProperty(cursorRef.current, 'rotation') as number;
                        const normalizedRotation = currentRotation % 360;

                        spinTl.current.kill();
                        spinTl.current = gsap.timeline({ repeat: -1 }).to(cursorRef.current, {
                            rotation: '+=360',
                            duration: spinDuration,
                            ease: 'none',
                        });

                        gsap.to(cursorRef.current, {
                            rotation: normalizedRotation + 360,
                            duration: spinDuration * (1 - normalizedRotation / 360),
                            ease: 'none',
                            onComplete: () => {
                                spinTl.current?.restart();
                            },
                        });
                    }
                    resumeTimeout = null;
                }, 50);

                if (target) {
                    cleanupTarget(target);
                }
            };

            currentTargetMove = targetMove;
            currentLeaveHandler = leaveHandler;

            target.addEventListener('mousemove', targetMove);
            target.addEventListener('mouseleave', leaveHandler);
        };

        window.addEventListener('mouseover', enterHandler as any, { passive: true });

        return () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseover', enterHandler as any);

            if (activeTarget) {
                cleanupTarget(activeTarget);
            }

            if (resumeTimeout) {
                clearTimeout(resumeTimeout);
            }

            spinTl.current?.kill();

            if (cursorRef.current) {
                gsap.killTweensOf(cursorRef.current);
            }
            cornersRef.current.forEach(corner => gsap.killTweensOf(corner));

            document.body.classList.remove('no-cursor');
            document.body.style.cursor = originalCursor;
        };
    }, [targetSelector, spinDuration, hideDefaultCursor]);

    if (isMobile) return null;

    return (
        <div
            ref={cursorRef}
            className="top-0 left-0 z-9999 fixed w-0 h-0 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-difference transform opacity-0"
            style={{ willChange: 'transform' }}
        >
            <div
                className="top-1/2 left-1/2 absolute bg-white rounded-full w-1 h-1 -translate-x-1/2 -translate-y-1/2 transform"
                style={{ willChange: 'transform' }}
            />
            <div
                ref={(el) => { if (el) cornersRef.current[0] = el; }}
                className="top-1/2 left-1/2 absolute border-[3px] border-white border-r-0 border-b-0 w-3 h-3 -translate-x-[150%] -translate-y-[150%] target-cursor-corner transform"
                style={{ willChange: 'transform' }}
            />
            <div
                ref={(el) => { if (el) cornersRef.current[1] = el; }}
                className="top-1/2 left-1/2 absolute border-[3px] border-white border-b-0 border-l-0 w-3 h-3 -translate-y-[150%] translate-x-1/2 target-cursor-corner transform"
                style={{ willChange: 'transform' }}
            />
            <div
                ref={(el) => { if (el) cornersRef.current[2] = el; }}
                className="top-1/2 left-1/2 absolute border-[3px] border-white border-t-0 border-l-0 w-3 h-3 translate-x-1/2 translate-y-1/2 target-cursor-corner transform"
                style={{ willChange: 'transform' }}
            />
            <div
                ref={(el) => { if (el) cornersRef.current[3] = el; }}
                className="top-1/2 left-1/2 absolute border-[3px] border-white border-t-0 border-r-0 w-3 h-3 -translate-x-[150%] translate-y-1/2 target-cursor-corner transform"
                style={{ willChange: 'transform' }}
            />
        </div>
    );
};

export default TargetCursor;
