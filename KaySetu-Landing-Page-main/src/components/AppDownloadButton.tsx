"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { appLinks } from "@/lib/content";

type Platform = "ios" | "android";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac — touch points give it away.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS ? "ios" : "android";
}

export default function AppDownloadButton() {
  const [platform, setPlatform] = useState<Platform>("android");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <a
      href={appLinks[platform]}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 border border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl duration-300"
    >
      <Download className="h-5 w-5 text-[#3bccff]" />
      <span className="text-sm font-semibold leading-tight">Download the App</span>
    </a>
  );
}
