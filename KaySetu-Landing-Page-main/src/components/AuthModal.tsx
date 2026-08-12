"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, User, Building2, ArrowRight, Loader2 } from "lucide-react";
import { nav, brand } from "@/lib/content";
import { useScrollLock } from "@/lib/useScrollLock";

export type AuthMode = "login" | "signup";

const copy = {
  login: {
    title: "Welcome back",
    sub: "Sign in to your KaySetu workspace.",
    cta: "Log in",
    switchText: "New to KaySetu?",
    switchCta: "Create an account",
  },
  signup: {
    title: "Create your account",
    sub: "Start with a guided trial. No card required.",
    cta: "Create account",
    switchText: "Already have an account?",
    switchCta: "Log in",
  },
} as const;

function Field({
  icon: FieldIcon,
  ...props
}: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-paper/70 px-3.5 py-2.5 transition-colors focus-within:border-accent/50 focus-within:bg-card">
      <FieldIcon className="h-4 w-4 shrink-0 text-faint" />
      <input
        {...props}
        className="w-full min-w-0 bg-transparent text-[0.9rem] text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}

export default function AuthModal({
  open,
  mode,
  onModeChange,
  onClose,
}: {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => setMounted(true), []);

  // The page behind the overlay must not move.
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setPending(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const t = copy[mode];

  // Auth itself lives on the product hosts (see `nav` in lib/content.ts), so the
  // form hands off there with the email prefilled. Swap this for a call to the
  // auth API once the marketing site is allowed to sign users in directly.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const base = mode === "login" ? nav.login.href : nav.signup.href;
    const url = new URL(base);
    if (email) url.searchParams.set("email", email);
    window.location.href = url.toString();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-espresso/50 backdrop-blur-sm"
      />

      <div className="animate-dropdown relative w-full max-w-[26rem] overflow-hidden rounded-3xl border border-line bg-card shadow-2xl">
        <span className="block h-0.5 w-full bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-paper hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-7 pb-7 pt-6">
          <img src="/logo2.png" alt={brand.name} className="h-8 w-auto object-contain" />

          <h2 className="mt-5 font-display text-2xl font-bold text-ink">{t.title}</h2>
          <p className="mt-1 text-[0.88rem] text-muted">{t.sub}</p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-3">
            {mode === "signup" ? (
              <>
                <Field icon={User} name="name" placeholder="Full name" autoComplete="name" autoFocus required />
                <Field icon={Building2} name="company" placeholder="Company" autoComplete="organization" required />
              </>
            ) : null}

            <Field
              icon={Mail}
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              autoComplete="email"
              autoFocus={mode === "login"}
              required
            />
            <Field
              icon={Lock}
              type="password"
              name="password"
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />

            {mode === "login" ? (
              <div className="flex justify-end">
                <a
                  href={`${nav.login.href.replace(/\/login$/, "")}/forgot-password`}
                  className="text-[0.8rem] font-medium text-muted transition-colors hover:text-accent"
                >
                  Forgot password?
                </a>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-70"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.cta}
              {pending ? null : <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[0.85rem] text-muted">
            {t.switchText}{" "}
            <button
              type="button"
              onClick={() => onModeChange(mode === "login" ? "signup" : "login")}
              className="font-semibold text-accent transition-opacity hover:opacity-80"
            >
              {t.switchCta}
            </button>
          </p>

          {mode === "signup" ? (
            <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-faint">
              By creating an account you agree to our{" "}
              <a href="/terms" className="underline hover:text-muted">terms</a> and{" "}
              <a href="/privacy" className="underline hover:text-muted">privacy policy</a>.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
