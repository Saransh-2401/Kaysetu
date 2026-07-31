import { Reveal } from "@/components/Motion";
import { proofWall } from "@/lib/content";

type Item = (typeof proofWall.items)[number];

/* Faithful re-creation of the Stokt "Don't take our word for it" section:
   centered kicker + big heading with an accent asterisk + small sub-label,
   then a horizontal marquee wall of dark, staggered-height quote cards. */

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function QuoteCard({ t }: { t: Item }) {
  return (
    <figure className="relative flex w-[19rem] shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-espresso p-7 text-card shadow-float sm:w-[22rem]">
      {/* faint oversized quote glyph */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 top-2 select-none font-display text-[6rem] leading-none text-card/[0.06]"
      >
        &rdquo;
      </span>
      <blockquote className="relative text-[0.95rem] font-medium leading-relaxed text-card/90">
        {t.quote}
      </blockquote>
      <figcaption className="mt-7 flex items-center gap-3 border-t border-card/10 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-sm font-bold text-accent-soft">
          {initials(t.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-card">{t.name}</div>
          <div className="mt-0.5 truncate font-mono text-[0.6rem] uppercase tracking-wider text-card/45">
            {t.role}
          </div>
          <div className="truncate font-mono text-[0.6rem] uppercase tracking-wider text-accent-soft">
            {t.company}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

function Row({
  items,
  reverse = false,
  duration = 46,
}: {
  items: Item[];
  reverse?: boolean;
  duration?: number;
}) {
  return (
    <div className="group marquee-mask overflow-hidden">
      <div
        className="marquee-track items-start"
        style={{
          ["--marquee-duration" as string]: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 items-start gap-5 pr-5">
          {items.map((t, i) => (
            <QuoteCard key={`a-${i}`} t={t} />
          ))}
        </div>
        <div className="flex shrink-0 items-start gap-5 pr-5" aria-hidden>
          {items.map((t, i) => (
            <QuoteCard key={`b-${i}`} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProofWall() {
  const half = Math.ceil(proofWall.items.length / 2);
  const rowTop = proofWall.items.slice(0, half);
  const rowBottom = proofWall.items.slice(half);

  return (
    <section
      id="testimonials"
      className="border-t border-line bg-paper py-20 md:py-28"
    >

      <div className="flex flex-col gap-5">
        <Row items={rowTop} duration={48} />
        <Row items={rowBottom} reverse duration={54} />
      </div>
    </section>
  );
}
