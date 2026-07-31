import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Reveal, WordReveal } from "@/components/Motion";
import { homeHero } from "@/lib/content";

export default function HeroBanner() {
  const { banner } = homeHero;

  // Flatten the ink headline lines into one string so the word-by-word
  // reveal cascades continuously, then hand the accent line the next slot.
  const inkText = homeHero.titleLines.join(" ");
  const inkWordCount = inkText.split(" ").length;
  const accentWordCount = homeHero.titleAccent.split(" ").length;
  const totalWordCount = inkWordCount + accentWordCount;

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-paper sm:min-h-[640px] lg:min-h-[720px]"
    >
      {/* ── Banner illustration as full-bleed background ─────────── */}
      {banner.src ? (
        <Image
          src={banner.src}
          alt={banner.alt}
          fill
          priority
          unoptimized={banner.src.endsWith(".svg")}
          sizes="100vw"
          className="-z-20 object-cover object-bottom"
        />
      ) : null}

      {/* left scrim → keeps the text crisp over the artwork */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-paper via-paper/80 to-transparent md:via-paper/55" />
      {/* bottom fade → blends the banner into the next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-paper" />

      {/* ── Text, left-aligned in the open left zone of the scene ── */}
      <div className="mx-auto w-full max-w-[1600px] px-5 py-16">
        <div className="max-w-2xl">
          <h1 className="display-xl text-[2.7rem] leading-[0.98] sm:text-[3.4rem] md:text-[4.2rem]">
            <WordReveal
              as="span"
              text={inkText}
              className="text-ink block"
              delay={80}
              stagger={90}
            />
            <WordReveal
              as="span"
              text={homeHero.titleAccent}
              className="text-accent block"
              delay={80 + inkWordCount * 90}
              stagger={90}
            />
          </h1>

          <Reveal delay={120}>
            <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-muted">
              {homeHero.subhead}
            </p>
          </Reveal>

          <Reveal delay={180}>
            <a
              href={homeHero.primary.href}
              className="btn-primary group mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[0.98rem] font-semibold"
            >
              {homeHero.primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
