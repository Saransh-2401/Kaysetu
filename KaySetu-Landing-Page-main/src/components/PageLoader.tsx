'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandMark from '@/components/BrandMark';

const STATUS_STEPS = [
  'Initializing enterprise platform...',
  'Connecting field sales & beat routes...',
  'Syncing multi-warehouse inventory...',
  'Reconciling GST finance & accounts...',
  'Ready',
];

const MODULE_PILLS = ['SALES', 'INVENTORY', 'MANUFACTURING', 'GST & ACCOUNTS'];

export default function PageLoader() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    // Check if user has already seen loader in this session
    const hasSeenLoader = sessionStorage.getItem('kaysetu_loader_seen');
    if (hasSeenLoader) {
      setLoading(false);
      return;
    }

    // Progress counter timer (0% to 100% in ~1.25s)
    const startTime = Date.now();
    const duration = 1250;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.floor((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (pct < 25) setStatusIndex(0);
      else if (pct < 50) setStatusIndex(1);
      else if (pct < 75) setStatusIndex(2);
      else if (pct < 95) setStatusIndex(3);
      else setStatusIndex(4);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          sessionStorage.setItem('kaysetu_loader_seen', 'true');
        }, 250);
      }
    }, 20);

    return () => clearInterval(interval);
  }, []);

  if (!loading) return null;

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          id="kaysetu-page-loader"
          key="kaysetu-page-loader"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.03,
            transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#081329] text-white select-none overflow-hidden"
        >
          {/* Ambient teal radial glow backdrops */}
          <div
            aria-hidden
            className="pointer-events-none absolute h-[650px] w-[650px] rounded-full bg-[#009688]/22 blur-[150px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 h-[450px] w-[850px] rounded-full bg-blue-600/12 blur-[130px]"
          />

          {/* Hairline tech grid pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,150,136,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,150,136,0.04)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]"
          />

          <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center">
            {/* Centerpiece Glass Brand Emblem with Official KaySetu Bridge Mark */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              {/* Outer glowing aura rings */}
              <motion.div
                animate={{ scale: [1, 1.28, 1], opacity: [0.45, 0.15, 0.45] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-3xl bg-[#009688]/30 blur-lg"
              />

              {/* Glass Card Icon Container with user requested logo.png */}
              <div className="relative flex h-24 w-32 items-center justify-center rounded-3xl border border-white/30 bg-gradient-to-br from-white/30 via-white/15 to-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,150,136,0.4)] p-4">
                <img
                  src="/logo.png"
                  alt="KaySetu Logo"
                  className="h-12 w-auto object-contain drop-shadow-md brightness-110"
                />

                {/* Live operational status pulse dot */}
                <div className="absolute right-2.5 top-2.5 flex items-center justify-center">
                  <span className="absolute h-3 w-3 rounded-full bg-teal-400 opacity-75 animate-ping" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#009688]" />
                </div>
              </div>
            </motion.div>

            {/* Official KaySetu Brand Title */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-1 flex items-center justify-center gap-1.5"
            >
              <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                KAY<span className="text-[#009688]">SETU</span>
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#009688] animate-pulse" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-teal-300/90 mb-7"
            >
              CONNECT EVERY OPERATION
            </motion.p>

            {/* Active Operational Module Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-7 max-w-xs">
              {MODULE_PILLS.map((pill, idx) => {
                const isActive = (progress / 100) * MODULE_PILLS.length >= idx;
                return (
                  <span
                    key={pill}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] font-medium tracking-wider transition-all duration-300 ${
                      isActive
                        ? 'border border-[#009688]/60 bg-[#009688]/20 text-teal-300 shadow-[0_0_12px_rgba(0,150,136,0.3)]'
                        : 'border border-white/10 bg-white/5 text-slate-500'
                    }`}
                  >
                    {pill}
                  </span>
                );
              })}
            </div>

            {/* Glassmorphism Progress Bar Track */}
            <div className="relative h-2 w-72 overflow-hidden rounded-full border border-white/15 bg-white/10 p-0.5 mb-3.5 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#009688] via-[#26a69a] to-teal-300 shadow-[0_0_12px_#009688]"
                style={{ width: `${progress}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>

            {/* Status Telemetry & Percentage Badge */}
            <div className="flex items-center justify-between w-72 text-xs font-mono">
              <span className="text-slate-300/80 truncate max-w-[210px] text-left">
                {STATUS_STEPS[statusIndex]}
              </span>
              <span className="text-teal-300 font-bold tracking-wider">{progress}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
