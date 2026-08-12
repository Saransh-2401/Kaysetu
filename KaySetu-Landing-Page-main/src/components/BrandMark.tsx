/* The KaySetu bridge mark, drawn rather than loaded: every logo file in
   /public is the navy wordmark on transparent, so it vanishes on dark surfaces
   and goes soft below ~80px. The arcs take `currentColor`, so the mark sits on
   any background; the blade stays teal to keep it on-brand. */
export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="404 178 92 36" className={className} aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <path d="M408 210 A24 24 0 0 1 456 210" />
        <path d="M444 210 A24 24 0 0 1 492 210" />
      </g>
      <path
        d="M450 194 C453 200, 455 205, 455 210 L445 210 C445 205, 447 200, 450 194 Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}
