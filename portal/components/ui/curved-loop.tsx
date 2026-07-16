"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';

interface CurvedLoopProps {
    marqueeText?: string;
    speed?: number;
    className?: string;
    curveAmount?: number;
    direction?: 'left' | 'right';
    interactive?: boolean;
}

const cn = (...classes: (string | undefined | null | boolean)[]): string => {
    return classes.filter(Boolean).join(' ');
};

export const CurvedLoop: React.FC<CurvedLoopProps> = ({
    marqueeText = '',
    speed = 2,
    className = '',
    curveAmount = 400,
    direction = 'left',
    interactive = true
}) => {
    const text = useMemo(() => {
        const hasTrailing = /\s|\u00A0$/.test(marqueeText);
        return (hasTrailing ? marqueeText.replace(/\s+$/, '') : marqueeText) + '\u00A0';
    }, [marqueeText]);

    const measureRef = useRef<SVGTextElement>(null);
    const textPathRef = useRef<SVGTextPathElement>(null);
    const [spacing, setSpacing] = useState(0);
    const [offset, setOffset] = useState(0);
    const [ready, setReady] = useState(false);
    const uid = useMemo(() => Math.random().toString(36).substring(2, 9), []);
    const pathId = `curve-${uid}`;

    // Use a larger vertical viewBox to accommodate the curve
    // If curveAmount is -300, we need height to cover at least that range.
    // Move everything up to save space
    const pathD = useMemo(() => `M-200,250 Q720,${250 + curveAmount} 1640,250`, [curveAmount]);

    const dragRef = useRef(false);
    const lastXRef = useRef(0);
    const dirRef = useRef<'left' | 'right'>(direction);
    const velRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    const totalText = useMemo(() => {
        if (!spacing) return text;
        // Repeat enough times to cover the width plus buffer
        return Array(Math.ceil(4000 / spacing) + 3)
            .fill(text)
            .join('');
    }, [text, spacing]);

    const updateSpacing = useCallback(() => {
        if (measureRef.current) {
            const length = measureRef.current.getComputedTextLength();
            if (length > 0) {
                setSpacing(length);
                setReady(true);
            }
        }
    }, []);

    const animate = useCallback(() => {
        if (!spacing) return;

        const step = () => {
            if (!dragRef.current && textPathRef.current) {
                const delta = dirRef.current === 'right' ? speed : -speed;
                const currentOffset = parseFloat(textPathRef.current.getAttribute('startOffset') || '0');
                let newOffset = currentOffset + delta;

                // Wrap logic
                if (newOffset <= -spacing) newOffset += spacing;
                if (newOffset >= spacing) newOffset -= spacing;

                textPathRef.current.setAttribute('startOffset', `${newOffset}px`);
                setOffset(newOffset);
            }
            animationFrameRef.current = requestAnimationFrame(step);
        };
        animationFrameRef.current = requestAnimationFrame(step);
    }, [spacing, speed]);

    const stopAnimation = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        if (!interactive) return;
        dragRef.current = true;
        lastXRef.current = e.clientX;
        velRef.current = 0;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!interactive || !dragRef.current || !textPathRef.current) return;
        const dx = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;
        velRef.current = dx;

        const currentOffset = parseFloat(textPathRef.current.getAttribute('startOffset') || '0');
        let newOffset = currentOffset + dx;

        if (newOffset <= -spacing) newOffset += spacing;
        if (newOffset >= spacing) newOffset -= spacing;

        textPathRef.current.setAttribute('startOffset', `${newOffset}px`);
        setOffset(newOffset);
    };

    const endDrag = () => {
        if (!interactive) return;
        dragRef.current = false;
        dirRef.current = velRef.current > 0 ? 'right' : 'left';
    };

    useEffect(() => {
        const id = setTimeout(updateSpacing, 150);
        return () => clearTimeout(id);
    }, [updateSpacing, marqueeText]);

    useEffect(() => {
        if (ready && spacing) {
            animate();
        }
        return () => stopAnimation();
    }, [ready, spacing, animate, stopAnimation]);

    const cursorStyle = interactive ? (dragRef.current ? 'grabbing' : 'grab') : 'auto';

    return (
        <div
            className="flex items-center justify-center w-full overflow-hidden pt-4 md:pt-8 pb-0"
            style={{
                visibility: ready ? 'visible' : 'hidden',
                cursor: cursorStyle,
                backgroundColor: '#050505',
                position: 'relative'
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
        >
            <svg
                className="select-none w-full overflow-visible block text-[3.5rem] md:text-[6.5rem] font-black uppercase leading-none"
                viewBox="0 0 1440 220"
                preserveAspectRatio="xMidYMid meet"
            >
                <text
                    ref={measureRef}
                    xmlSpace="preserve"
                    style={{
                        visibility: 'hidden',
                        opacity: 0,
                        pointerEvents: 'none',
                        fontWeight: 900
                    }}
                >
                    {text}
                </text>

                <defs>
                    <path id={pathId} d={pathD} fill="none" stroke="transparent" />
                </defs>

                {ready && (
                    <text xmlSpace="preserve" fill="#D4AF37" className={className}>
                        <textPath ref={textPathRef} href={`#${pathId}`} startOffset={`${offset}px`} xmlSpace="preserve">
                            {totalText}
                        </textPath>
                    </text>
                )}
            </svg>
        </div>
    );
};

export default CurvedLoop;
