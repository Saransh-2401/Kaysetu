import type { Metadata } from "next";
import Icon from "@/components/Icon";
import { PageShell, PageHeader } from "@/components/PageChrome";
import { careersPage } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Careers at Kayease — Build KaySetu ERP + CRM" },
  description:
    "Help build KaySetu, a unified ERP + CRM for Indian SMEs. Open roles in full-stack engineering, Flutter mobile, product design and success. Remote-friendly.",
  keywords: [
    "Kayease careers",
    "KaySetu jobs",
    "Next.js engineer jobs India",
    "Flutter developer jobs",
    "product designer jobs remote",
    "ERP CRM startup jobs",
  ],
  alternates: { canonical: "/careers" },
  openGraph: {
    title: "Careers at Kayease — Build KaySetu",
    description:
      "Open roles building KaySetu, the unified ERP + CRM platform. Engineering, mobile, design and success. Remote-friendly, India.",
    type: "website",
    url: "/careers",
  },
};

export default function CareersPage() {
  const p = careersPage;
  return (
    <PageShell>
      <PageHeader kicker={p.kicker} title={p.title} lead={p.lead} />

      {/* perks */}
      <section className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {p.perks.map((perk) => (
            <div key={perk.title} className="bg-paper p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-accent">
                <Icon name={perk.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold leading-snug">{perk.title}</h3>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">{perk.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* open roles */}
      <section className="border-t border-line bg-card/40">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:py-24">
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {p.roles.map((role) => (
              <li key={role.title}>
                <a
                  href={p.cta.href}
                  className="group flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-display text-lg font-bold">{role.title}</h3>
                    <p className="mt-0.5 text-[0.85rem] text-muted">{role.team}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[0.8rem] text-muted">
                    <span className="rounded-full border border-line bg-paper px-3 py-1">{role.location}</span>
                    <span className="rounded-full border border-line bg-paper px-3 py-1">{role.type}</span>
                    <span className="font-semibold text-accent transition group-hover:translate-x-0.5">→</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* open application */}
      <section className="mx-auto max-w-[1600px] px-5 py-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-card p-8 sm:flex-row sm:items-center md:p-12">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">{p.cta.title}</h2>
            <p className="mt-2 text-muted">{p.cta.text}</p>
          </div>
          <a
            href={p.cta.href}
            className="btn-primary inline-flex items-center gap-1.5 rounded-full px-6 py-3 text-sm font-semibold"
          >
            <span className="text-white/90">▸</span> {p.cta.label}
          </a>
        </div>
      </section>
    </PageShell>
  );
}
