"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { LeadError, submitLead } from "@/lib/leads";

/**
 * Footer "Request a Demo" email capture.
 *
 * Previously this was `<form action="/contact">` - a plain GET that navigated
 * away and threw the typed address on the floor, forcing the visitor to type it
 * again on the contact page. Now the email is captured immediately as a lead.
 */
export default function DemoEmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      await submitLead({
        // The footer only asks for an email; the ops team follows up for the
        // rest. Name is required by the API, so mark where it came from.
        name: email.split("@")[0] || "Demo request",
        email,
        message: "Requested a demo from the site footer.",
        source: "footer_demo",
      });
      setState("done");
    } catch (err) {
      setError(err instanceof LeadError ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        className="flex w-full max-w-md items-center gap-3 rounded-full bg-white/10 px-6 py-4 text-white ring-1 ring-white/20"
        role="status"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <span className="text-[0.95rem] font-medium">
          Thanks, we&apos;ll be in touch shortly.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="flex w-full gap-2">
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your work email"
          required
          disabled={state === "sending"}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.07] px-4 py-3 text-[0.9rem] text-white outline-none transition-colors placeholder:text-white/40 focus:border-accent focus:bg-white/10 disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex w-12 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-soft disabled:opacity-70"
          aria-label="Request a demo"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 pl-2 text-[0.82rem] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
