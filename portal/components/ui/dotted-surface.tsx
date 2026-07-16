'use client';
import { cn } from '@/lib/utils';
import { useTheme } from '@mui/material';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
    const muiTheme = useTheme();
    const theme = muiTheme.palette.mode;

    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        particles: THREE.Points[];
        animationId: number;
        count: number;
    } | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let scene: THREE.Scene;
        let camera: THREE.PerspectiveCamera;
        let renderer: THREE.WebGLRenderer;
        let points: THREE.Points;
        let animationId: number;
        let count = 0;

        const SEPARATION = 150;
        const AMOUNTX = 40;
        const AMOUNTY = 60;

        const init = (width: number, height: number) => {
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog(0x050505, 2000, 10000);

            camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
            camera.position.set(0, 500, 1200);
            camera.lookAt(0, 400, 0);

            renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(width, height);
            renderer.setClearColor(0x050505, 1);

            containerRef.current?.appendChild(renderer.domElement);

            const positions: number[] = [];
            const colors: number[] = [];
            const geometry = new THREE.BufferGeometry();

            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
                    positions.push(x, 0, iy * SEPARATION - (AMOUNTY * SEPARATION) / 2);
                    colors.push(0.8, 0.8, 0.8);
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 25,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                sizeAttenuation: true,
            });

            points = new THREE.Points(geometry, material);
            scene.add(points);

            animate();
        };

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            if (!points || !renderer || !scene || !camera) return;

            const positions = points.geometry.attributes.position.array as Float32Array;
            let i = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    positions[i * 3 + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
                    i++;
                }
            }
            points.geometry.attributes.position.needsUpdate = true;
            renderer.render(scene, camera);
            count += 0.05;
        };

        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            if (width === 0 || height === 0) return;

            if (!renderer) {
                init(width, height);
            } else {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            if (animationId) cancelAnimationFrame(animationId);
            if (renderer) {
                renderer.dispose();
                if (containerRef.current && renderer.domElement.parentElement === containerRef.current) {
                    containerRef.current.removeChild(renderer.domElement);
                }
            }
            if (points) {
                points.geometry.dispose();
                (points.material as THREE.Material).dispose();
            }
        };
    }, [theme]);

    return (
        <div
            ref={containerRef}
            className={cn('pointer-events-none absolute inset-0 z-10 h-full w-full', className)}
            {...props}
        />
    );
}
