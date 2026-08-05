import Link from "next/link";
import Image from "next/image";
import { footer } from "@/lib/content";
import DemoEmailForm from "@/components/DemoEmailForm";
import type { SVGProps } from "react";

const LinkedinIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
);

const FacebookIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
  </svg>
);

const XIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);

const InstagramIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-white text-slate-900 mt-auto overflow-hidden font-sans border-t border-line">
      <div className="flex flex-col xl:flex-row relative">
        {/* Left Section: Brand & Links */}
        <div className="xl:w-[55%] 2xl:w-[60%] px-10 py-6 lg:px-16 lg:py-10 xl:pl-20 xl:pr-10 xl:py-12 flex flex-col md:flex-row xl:flex-col 2xl:flex-row gap-10 lg:gap-16 xl:gap-12 2xl:gap-20 relative z-10">

          {/* Brand & Socials */}
          <div className="w-full md:max-w-[350px] 2xl:max-w-[400px] shrink-0">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80 shrink-0 -mb-10 -mt-6">
              <img
                src="/logo3.png"
                alt="KaySetu"
                className="w-56 md:w-64 h-auto object-contain -ml-2"
              />
            </Link>
            <p className="text-[0.95rem] leading-relaxed text-slate-600 mb-8">
              {footer.description}
            </p>

            <div className="flex gap-3">
              <a href="#" aria-label="LinkedIn" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-accent hover:border-accent transition-all">
                <LinkedinIcon className="w-[1rem] h-[1rem]" />
              </a>
              <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-accent hover:border-accent transition-all">
                <FacebookIcon className="w-[1rem] h-[1rem]" />
              </a>
              <a href="#" aria-label="X (Twitter)" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-accent hover:border-accent transition-all">
                <XIcon className="w-[1rem] h-[1rem]" />
              </a>
              <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-accent hover:border-accent transition-all">
                <InstagramIcon className="w-[1rem] h-[1rem]" />
              </a>
            </div>
          </div>

          {/* Link Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 lg:gap-10 xl:gap-8 2xl:gap-12 w-full">
            {footer.columns.slice(0, 3).map((col) => (
              <div key={col.title}>
                <h4 className="font-bold text-accent text-[0.85rem] uppercase tracking-wide mb-6">
                  {col.title}
                </h4>
                <ul className="space-y-4 text-[0.9rem] text-slate-600">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="hover:text-accent transition-colors font-medium"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section: Demo & Illustration */}
        {/* We use a container that grows, with a dark teal gradient background */}
        <div className="xl:w-[45%] relative bg-gradient-to-br from-[#062420] to-[#041613] p-10 lg:p-16 xl:py-20 xl:pr-20 overflow-hidden flex items-center">

          {/* Diagonal cut mask for desktop */}
          <div className="hidden xl:block absolute inset-y-0 left-0 w-32 bg-white -skew-x-[12deg] origin-top-left -ml-16 z-10" />

          {/* Decorative circular concentric lines in background */}
          <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none opacity-20">
            <div className="absolute inset-0 rounded-full border border-white/20" />
            <div className="absolute inset-10 rounded-full border border-white/20" />
            <div className="absolute inset-24 rounded-full border border-white/20" />
            <div className="absolute inset-40 rounded-full border border-white/20" />
            <div className="absolute inset-60 rounded-full border border-white/20" />
          </div>

          <div className="relative z-20 w-full max-w-xl xl:ml-12">
            <span className="text-white/60 text-[0.75rem] uppercase font-bold tracking-widest mb-4 block">
              DEMO
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display mb-8 text-white font-medium">
              Request a Demo
            </h2>
            <DemoEmailForm />
          </div>

          {/* Illustration pinned to the bottom right */}
          <div className="absolute right-0 bottom-0 w-[450px] h-[250px] z-20 pointer-events-none hidden sm:block opacity-90 mix-blend-screen">
            <Image
              src="/hero-distribution.svg"
              alt="Illustration"
              fill
              className="object-contain object-bottom"
            />
          </div>
        </div>
      </div>

      {/* Legal Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-6 md:px-10 lg:px-16 xl:px-20 py-6 text-[0.75rem] text-slate-500 border-t border-line bg-white text-center sm:text-left">
        <div className="mb-4 sm:mb-0 font-medium">{footer.copyright}</div>
        <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 font-medium">
          <Link href="/contact" className="hover:text-accent transition-colors">
            Support
          </Link>
          {footer.legal?.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-accent transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
