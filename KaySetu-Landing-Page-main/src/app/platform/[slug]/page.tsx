import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { modulePages } from "@/lib/modulePages";
import Walkthrough from "@/components/Walkthrough";
import { Reveal } from "@/components/Motion";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Only the known modules render; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return modulePages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = modulePages.find((p) => p.slug === slug);
  if (!mod) return {};
  const url = `/platform/${mod.slug}`;
  return {
    title: { absolute: mod.seo.title },
    description: mod.seo.description,
    keywords: mod.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: mod.seo.title,
      description: mod.seo.description,
      type: "website",
      url,
      siteName: "KaySetu",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: mod.seo.title,
      description: mod.seo.description,
    },
  };
}

// `params` is a Promise in Next 15+ — awaiting it is what makes these pages
// render at all (reading `params.slug` directly yields undefined → 404).
export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pageData = modulePages.find((p) => p.slug === slug);

  if (!pageData) {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(0,150,136,0.1),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-5 text-center">
          <Reveal>
            <span className="mb-4 inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-[0.8rem] font-bold tracking-wider text-accent">
              MODULE {pageData.hero.kicker}
            </span>
            <h1 className="mb-6 font-display text-4xl font-bold tracking-tight text-ink md:text-6xl balance">
              {pageData.hero.title}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted md:text-xl balance">
              {pageData.hero.lead}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Reusable Walkthrough Component */}
      <Walkthrough data={pageData.walkthrough} />
    </main>
    <Footer />
    </>
  );
}
