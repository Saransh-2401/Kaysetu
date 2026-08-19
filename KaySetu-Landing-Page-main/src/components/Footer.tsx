import Link from "next/link";
import { footer } from "@/lib/content";

export default function Footer() {
  return (
    <footer className="mt-auto bg-[#071738] font-sans text-white border-t border-white/10">
      {/* Full-bleed with fixed gutters - a centered max-w container left big
          dead margins on wide screens. */}
      <div className="w-full px-5 pt-10 pb-6 sm:px-8 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-6 xl:gap-8">
          
          {/* Brand Column with Right Divider */}
          <div className="lg:col-span-1 lg:border-r lg:border-white/10 lg:pr-6 pb-6 lg:pb-0 border-b border-white/10 lg:border-b-0">
            <Link
              href="/"
              aria-label="KaySetu home"
              className="inline-block font-display text-3xl font-bold tracking-tight text-white transition-opacity hover:opacity-90"
            >
              KaySetu
            </Link>
            <p className="mt-4 max-w-xs text-[0.85rem] leading-relaxed text-white/70">
              {footer.description}
            </p>
          </div>

          {/* Dynamic Link Columns in 2x2 Grid on Mobile */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:col-span-5">
            {footer.columns.map((col) => (
              <div key={col.title}>
                <h3 className="font-sans text-[0.85rem] font-bold tracking-wide text-white">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l: { label: string; href: string }) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[0.84rem] text-white/70 transition-colors hover:text-accent"
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

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.78rem] text-white/60">
          <div>{footer.copyright}</div>
        </div>
      </div>
    </footer>
  );
}
