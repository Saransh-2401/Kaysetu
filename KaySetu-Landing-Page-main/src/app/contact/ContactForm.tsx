"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Amp from "@/components/Amp";
import Icon from "@/components/Icon";
import { contactPage } from "@/lib/content";
import { LeadError, submitLead } from "@/lib/leads";

const f = contactPage.form;

/* Shared field shell - a leading Lucide icon sits inside the control. */
const inputBase =
  "w-full rounded-xl border border-line bg-paper/70 py-3 pl-11 pr-4 text-[0.92rem] text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:bg-card focus:ring-4 focus:ring-accent/10";

function FieldIcon({ name }: { name: string }) {
  return (
    <span className="pointer-events-none absolute left-4 top-3.5 text-faint">
      <Icon name={name} className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />
    </span>
  );
}

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [agree, setAgree] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Send the enquiry to the API. This form used to call preventDefault() and
   * flip straight to the success screen, so every lead was silently thrown
   * away - only ever show success after the server has actually accepted it.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    try {
      await submitLead({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        company: String(data.get("company") ?? ""),
        message: String(data.get("message") ?? ""),
        website: String(data.get("website") ?? ""), // honeypot
        attachment: fileRef.current?.files?.[0] ?? null,
        source: "contact_form",
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof LeadError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-line bg-card p-10 text-center shadow-soft">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon name="CheckCircle2" className="h-7 w-7" strokeWidth={1.7} />
        </div>
        <h3 className="mt-5 font-display text-2xl font-bold">{f.success.title}</h3>
        <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-muted">
          {f.success.body}
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setAgree(false);
            setFileName(null);
          }}
          className="mt-6 text-[0.85rem] font-semibold text-accent transition-colors hover:text-accent-ink"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-card p-7 shadow-float md:p-9">
      {/* h1, not h2: the contact hero was removed, so this is the first and
          only top-level heading on the page. Styling is unchanged. */}
      <h1 className="font-display text-[2.1rem] font-bold leading-[1.05] tracking-tight md:text-[2.6rem]">
        <Amp text={f.titleLead} /> <span className="text-accent"><Amp text={f.titleAccent} /></span>
      </h1>
      <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted">{f.note}</p>
      <div className="mt-5 h-1 w-12 rounded-full bg-accent" />

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {/* Honeypot: hidden from humans, irresistible to bots. A filled value
            makes the API discard the submission. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[0.88rem] text-red-700"
          >
            <Icon name="AlertCircle" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{error}</span>
          </div>
        )}

        {/* Name (full), Company + Phone (split), Email (full) */}
        <div className="grid gap-4 sm:grid-cols-2">
          {f.fields.map((field) => (
            <div key={field.name} className={`relative ${field.full ? "sm:col-span-2" : ""}`}>
              <FieldIcon name={field.icon} />
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                aria-label={field.label}
                placeholder={field.placeholder}
                className={inputBase}
              />
            </div>
          ))}
        </div>

        {/* Message */}
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-3.5 text-faint">
            <Icon name={f.message.icon} className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />
          </span>
          <textarea
            name={f.message.name}
            required={f.message.required}
            rows={4}
            aria-label="Message"
            placeholder={f.message.placeholder}
            className={`${inputBase} resize-none pt-3`}
          />
        </div>

        {/* Attachment dropzone */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-paper/50 px-4 py-5 text-center transition-colors hover:border-accent/50 hover:bg-accent/5"
        >
          <span className="flex items-center gap-2 text-[0.9rem] font-medium text-ink">
            <Icon
              name="Upload"
              className="h-4 w-4 text-accent transition-transform group-hover:-translate-y-0.5"
              strokeWidth={1.8}
            />
            {fileName ?? (
              <>
                {f.attachment.title}{" "}
                <span className="font-normal text-faint">{f.attachment.optional}</span>
              </>
            )}
          </span>
          <span className="text-[0.75rem] text-faint">{f.attachment.hint}</span>
          <input
            ref={fileRef}
            type="file"
            name="attachment"
            accept={f.attachment.accept}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="hidden"
          />
        </button>

        {/* Consent */}
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.85rem] text-muted">
          <input
            type="checkbox"
            required
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line text-accent accent-accent focus:ring-accent/30"
          />
          <span>
            {f.consent.lead}{" "}
            <Link href="/privacy" className="font-medium text-accent hover:underline">
              {f.consent.privacy}
            </Link>{" "}
            {f.consent.and}{" "}
            <Link href="/terms" className="font-medium text-accent hover:underline">
              {f.consent.terms}
            </Link>
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={sending}
          className="btn-primary group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[0.95rem] font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sending ? "Sending…" : f.submit}
          {!sending && (
            <Icon
              name="ArrowRight"
              className="h-[1.05rem] w-[1.05rem] transition-transform group-hover:translate-x-1"
              strokeWidth={2}
            />
          )}
        </button>

        <p className="pt-1 text-center text-[0.72rem] text-faint">{f.reassurance}</p>
      </form>
    </div>
  );
}
