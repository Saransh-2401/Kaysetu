import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ArrowLeft, Search, Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Nav />

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-ink mb-4">
            Lost in the workflow?
          </h1>

          <p className="text-muted text-base sm:text-lg max-w-lg mx-auto mb-8 leading-relaxed">
            The page you are looking for might have been moved, renamed, or is currently unavailable in our platform directory.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <Link
              href="/"
              className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-soft"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/80 px-6 py-3 text-sm font-semibold text-ink hover:bg-white transition-colors"
            >
              <Compass className="w-4 h-4 text-accent" />
              Explore Packages
            </Link>
          </div>

          <div className="pt-8 border-t border-line/10 text-left">
            <p className="text-xs font-mono uppercase tracking-wider text-faint mb-3 text-center">
              Popular Directory Destinations
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/modules?module=field-sales-operations"
                className="p-3.5 rounded-xl border border-line/10 bg-white/60 hover:bg-white hover:border-accent/30 transition-all text-xs font-medium text-ink flex flex-col justify-between"
              >
                <span className="font-semibold text-ink block mb-1">Field Sales CRM</span>
                <span className="text-muted text-[11px]">Track beats, orders & live agent GPS</span>
              </Link>

              <Link
                href="/modules?module=leads-pipeline"
                className="p-3.5 rounded-xl border border-line/10 bg-white/60 hover:bg-white hover:border-accent/30 transition-all text-xs font-medium text-ink flex flex-col justify-between"
              >
                <span className="font-semibold text-ink block mb-1">Leads & Quotes</span>
                <span className="text-muted text-[11px]">Automate lead-to-cash pipeline</span>
              </Link>

              <Link
                href="/contact"
                className="p-3.5 rounded-xl border border-line/10 bg-white/60 hover:bg-white hover:border-accent/30 transition-all text-xs font-medium text-ink flex flex-col justify-between"
              >
                <span className="font-semibold text-ink block mb-1">Get in Touch</span>
                <span className="text-muted text-[11px]">Talk to our product specialists</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
