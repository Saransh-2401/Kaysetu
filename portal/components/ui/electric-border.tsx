"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';

type ElectricBorderProps = {
    color?: string;
    speed?: number;
    chaos?: number;
    thickness?: number;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
};

function hexToRgba(hex: string, alpha = 1): string {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h
            .split('')
            .map(c => c + c)
            .join('');
    }
    const int = parseInt(h, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const ElectricBorder: React.FC<ElectricBorderProps> = ({
    color = '#28FF85',
    speed = 1,
    chaos = 1,
    thickness = 2,
    className = '',
    style = {},
    children
}) => {
    const rawId = useMemo(() => `id-${Math.random().toString(36).substring(2, 11)}`, []);
    const filterId = `turbulent-displace-${rawId}`;

    const svgRef = useRef<SVGSVGElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const strokeRef = useRef<HTMLDivElement>(null);

    const updateAnim = useCallback(() => {
        const svg = svgRef.current;
        const host = rootRef.current;
        if (!svg || !host) return;

        if (strokeRef.current) {
            strokeRef.current.style.filter = `url(#${filterId})`;
        }

        const width = Math.max(1, Math.round(host.clientWidth || host.getBoundingClientRect().width || 0));
        const height = Math.max(1, Math.round(host.clientHeight || host.getBoundingClientRect().height || 0));

        const dyAnims = Array.from(svg.querySelectorAll('feOffset > animate[attributeName="dy"]')) as SVGAnimateElement[];
        if (dyAnims.length >= 2) {
            dyAnims[0].setAttribute('values', `${height}; 0`);
            dyAnims[1].setAttribute('values', `0; -${height}`);
        }

        const dxAnims = Array.from(svg.querySelectorAll('feOffset > animate[attributeName="dx"]')) as SVGAnimateElement[];
        if (dxAnims.length >= 2) {
            dxAnims[0].setAttribute('values', `${width}; 0`);
            dxAnims[1].setAttribute('values', `0; -${width}`);
        }

        const baseDur = 6;
        const dur = Math.max(0.001, baseDur / (speed || 1));
        [...dyAnims, ...dxAnims].forEach(a => a.setAttribute('dur', `${dur}s`));

        const disp = svg.querySelector('feDisplacementMap');
        if (disp) disp.setAttribute('scale', String(30 * (chaos || 1)));

        const filterEl = svg.querySelector<SVGFilterElement>(`#${filterId}`);
        if (filterEl) {
            filterEl.setAttribute('x', '-200%');
            filterEl.setAttribute('y', '-200%');
            filterEl.setAttribute('width', '500%');
            filterEl.setAttribute('height', '500%');
        }

        requestAnimationFrame(() => {
            [...dyAnims, ...dxAnims].forEach((a: SVGAnimateElement) => {
                if (typeof a.beginElement === 'function') {
                    try {
                        a.beginElement();
                    } catch { }
                }
            });
        });
    }, [speed, chaos, filterId]);

    useEffect(() => {
        if (!rootRef.current) return;
        const ro = new ResizeObserver(() => updateAnim());
        ro.observe(rootRef.current);
        updateAnim();
        return () => ro.disconnect();
    }, [updateAnim]);

    const inheritRadiusValue = useMemo(() => {
        const radius = style?.borderRadius;
        if (radius === undefined) return 'inherit';
        if (typeof radius === 'number') return `${radius}px`;
        return radius as string;
    }, [style?.borderRadius]);

    const innerRadiusStyle = useMemo(() => ({ borderRadius: inheritRadiusValue }), [inheritRadiusValue]);

    const strokeStyle = useMemo(() => ({
        ...innerRadiusStyle,
        borderWidth: `${thickness}px`,
        borderStyle: 'solid',
        borderColor: color
    }), [innerRadiusStyle, thickness, color]);

    const glow1Style = useMemo(() => ({
        ...innerRadiusStyle,
        borderWidth: `${thickness}px`,
        borderStyle: 'solid',
        borderColor: hexToRgba(color, 0.6),
        filter: `blur(${0.5 + thickness * 0.25}px)`,
        opacity: 0.5
    }), [innerRadiusStyle, thickness, color]);

    const glow2Style = useMemo(() => ({
        ...innerRadiusStyle,
        borderWidth: `${thickness}px`,
        borderStyle: 'solid',
        borderColor: color,
        filter: `blur(${2 + thickness * 0.5}px)`,
        opacity: 0.5
    }), [innerRadiusStyle, thickness, color]);

    const bgGlowStyle = useMemo(() => ({
        ...innerRadiusStyle,
        transform: 'scale(1.08)',
        filter: 'blur(32px)',
        opacity: 0.3,
        zIndex: -1,
        background: `linear-gradient(-30deg, ${hexToRgba(color, 0.8)}, transparent, ${color})`
    }), [innerRadiusStyle, color]);

    return (
        <div ref={rootRef} className={`relative isolate flex flex-col ${className}`} style={{ ...style, padding: thickness * 2 }}>
            <svg
                ref={svgRef}
                className="fixed opacity-0 w-0 h-0 pointer-events-none"
                style={{ position: 'absolute', top: -9999, left: -9999 }}
                aria-hidden="true"
                focusable="false"
            >
                <defs>
                    <filter id={filterId} colorInterpolationFilters="sRGB" x="-200%" y="-200%" width="500%" height="500%">
                        <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="8" result="noise1" seed="1" />
                        <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
                            <animate attributeName="dy" values="500; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
                        </feOffset>

                        <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="8" result="noise2" seed="3" />
                        <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
                            <animate attributeName="dy" values="0; -500" dur="6s" repeatCount="indefinite" calcMode="linear" />
                        </feOffset>

                        <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="6" result="noise3" seed="5" />
                        <feOffset in="noise3" dx="0" dy="0" result="offsetNoise3">
                            <animate attributeName="dx" values="500; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
                        </feOffset>

                        <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="6" result="noise4" seed="7" />
                        <feOffset in="noise4" dx="0" dy="0" result="offsetNoise4">
                            <animate attributeName="dx" values="0; -500" dur="6s" repeatCount="indefinite" calcMode="linear" />
                        </feOffset>

                        <feComposite in="offsetNoise1" in2="offsetNoise2" operator="add" result="verticalNoise" />
                        <feComposite in="offsetNoise3" in2="offsetNoise4" operator="add" result="horizontalNoise" />
                        <feBlend in="verticalNoise" in2="horizontalNoise" mode="screen" result="combinedNoise" />

                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="combinedNoise"
                            scale="30"
                            xChannelSelector="R"
                            yChannelSelector="G"
                            result="displaced"
                        />
                    </filter>
                </defs>
            </svg>

            <div className="relative z-0 flex-1 flex flex-col" style={{ ...innerRadiusStyle, height: '100%' }}>
                {children}
            </div>

            <div className="absolute inset-0 pointer-events-none z-10" style={innerRadiusStyle}>
                <div ref={strokeRef} className="box-border absolute inset-0" style={strokeStyle} />
                <div className="box-border absolute inset-0" style={glow1Style} />
                <div className="box-border absolute inset-0" style={glow2Style} />
                <div className="absolute inset-0" style={bgGlowStyle} />
            </div>
        </div>
    );
};

export default ElectricBorder;
