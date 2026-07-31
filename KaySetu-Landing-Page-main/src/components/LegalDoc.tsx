import { PageShell, PageHeader } from "@/components/PageChrome";

type LegalContent = {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string }[];
  contact: { label: string; href: string };
};

export default function LegalDoc({ doc }: { doc: LegalContent }) {
  return (
    <PageShell>
      <PageHeader kicker={doc.kicker} title={doc.title} meta={doc.updated} />

      <article className="mx-auto max-w-3xl px-5 py-16 md:py-20">
        <p className="text-[1.02rem] leading-relaxed text-muted">{doc.intro}</p>

        <div className="mt-12 space-y-10">
          {doc.sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="flex items-baseline gap-3 font-display text-xl font-bold tracking-tight">
                <span className="font-mono text-sm text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-line bg-card p-6">
          <p className="text-[0.92rem] text-muted">
            Questions about this page? Contact us at{" "}
            <a href={doc.contact.href} className="font-medium text-accent hover:underline">
              {doc.contact.label}
            </a>
            .
          </p>
        </div>
      </article>
    </PageShell>
  );
}
