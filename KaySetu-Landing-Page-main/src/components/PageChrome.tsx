import AnnounceBar from "@/components/AnnounceBar";
import Amp from "@/components/Amp";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ClosingCta from "@/components/ClosingCta";

/* Shared shell for every sub-page - keeps the nav / footer / spacing
   identical to the home page so routes feel like one site.
   `cta` opts a page out of the closing band - the contact page is
   already one long "book a demo", so repeating it there is noise. */
export function PageShell({
  children,
  cta = true,
}: {
  children: React.ReactNode;
  cta?: boolean;
}) {
  return (
    <>
      <AnnounceBar />
      <Nav />
      <main>{children}</main>
      {cta && <ClosingCta />}
      <Footer />
    </>
  );
}

export function PageHeader({
  kicker,
  title,
  lead,
  meta,
}: {
  kicker: string;
  title: string;
  lead?: string;
  meta?: string;
}) {
  return (
    <header className="border-b border-line">
      <div className="grid-lines mx-auto max-w-[1600px] px-5 py-20 md:py-28">
        <div className="max-w-3xl">
          <h1 className="font-display text-[2.1rem] font-bold leading-[1.05] tracking-tight balance md:text-[3.2rem]">
            <Amp text={title} />
          </h1>
          {lead && (
            <p className="mt-6 text-[1.1rem] leading-relaxed text-muted">{lead}</p>
          )}
          {meta && (
            <p className="mt-6 font-mono text-[0.72rem] uppercase tracking-wider text-faint">
              {meta}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
