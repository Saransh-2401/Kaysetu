# KaySetu website — agent context

Handoff file for coding agents (Antigravity / Gemini, Claude Code, etc.).
Last updated: 2026-08-10.

---

## 1. Repo layout — where the work happens

`d:\kaysetu-website` holds several apps. **Almost all recent website work is in
`KaySetu-Landing-Page-main/`** — the public marketing site. Do not touch the
others unless asked.

| Path                        | What it is                                        |
| --------------------------- | ------------------------------------------------- |
| `KaySetu-Landing-Page-main/` | **The marketing site.** Next.js 16 App Router. Work here. |
| `frontend/`, `portal/`, `backend/`, `KaySetu/` | Separate product apps (ops console / API). Out of scope. |
| `docs/`, `docker-compose*.yml`, `Caddyfile`, `deploy.sh` | Infra + docs. |

Git: single repo, branch `main`, user `Kayease`. The working tree normally has
a large number of uncommitted modifications — that is the current state of work,
not accidental damage. Do not `git checkout --`/`reset --hard` anything.

---

## 2. Stack and commands

Run everything from `KaySetu-Landing-Page-main/`:

```bash
npm run dev     # next dev (turbopack)
npm run build   # next build — the real check; do this before claiming a fix
npm run lint    # eslint
```

- Next.js **16.2.11** (App Router), React **19.2.4**, TypeScript 5.
- **Tailwind CSS v4** — configured entirely in `src/app/globals.css` via
  `@theme`. There is **no `tailwind.config.js`**. Don't create one.
- lucide-react for icons, framer-motion/motion + gsap for animation.
- No test suite. Verification is: `npm run build` + a browser screenshot
  (see §7).

Platform is **Windows 11 / PowerShell**, with Git Bash also available. Paths in
scripts must be Windows-absolute (`C:/...`) when handed to Chrome or Playwright.

---

## 3. Design system

Tokens live in `src/app/globals.css` under `@theme`. Use the token classes
(`bg-card`, `text-ink`, `border-line`, `text-accent`…), not raw hex.

| Token            | Value                    | Use                              |
| ---------------- | ------------------------ | -------------------------------- |
| `--color-paper`  | `#eef2f5`                | page background                  |
| `--color-paper-2`| `#e3e9ee`                | slightly deeper band             |
| `--color-card`   | `#ffffff`                | floating cards                   |
| `--color-ink`    | `#10234b`                | deep navy — headings, body, dark sections |
| `--color-muted`  | `#56607a`                | secondary text                   |
| `--color-faint`  | `#94a0b4`                | tertiary / mono labels           |
| `--color-accent` | `#009688`                | teal — CTAs, links, highlights   |
| `--color-accent-soft` / `-ink` | `#26a69a` / `#00796b` | hover / pressed     |
| `--color-espresso` | `#10234b`              | alias of ink, used by dark bands |
| `--color-line` / `-2` | navy at 10% / 5.5%  | hairlines                        |

- **`bg-surface` does not exist.** Several files still use it; it silently
  resolves to nothing. Replace with `bg-paper` when you touch such a file.
  Known remaining offender: `src/app/platform/[slug]/page.tsx` (hero).
- Fonts: `font-display` (serif "Modern Romance" → Cormorant fallback) for
  headings, `font-sans` (Inter) for body, `font-mono` for kickers/labels.
  **The Modern Romance font files are not in `public/fonts/`** — the four 404s
  on every page load are expected; headings fall back to Cormorant by design.
- Shared utility classes in `globals.css`: `.kicker`, `.btn-primary`,
  `.shadow-soft`, `.shadow-float`, `.balance`, `.animate-fade-up` (+
  `.delay-1/2/3`), `.grid-lines`, `.cta-band`, `.pipe-flow`.
- Page sections are capped at `max-w-[1600px] px-5` and the footer matches this
  deliberately, so their edges line up.

---

## 4. Content architecture — edit data, not markup

Most page copy is data, not JSX:

- **`src/lib/content.ts`** — the big one (~1200 lines, ~40 named exports):
  `brand`, `announce`, `nav`, `platformMenu`, `industriesMenu`, `hero`,
  `homeHero`, `modules`, `operations`, `comparison`, `packages`, `spotlights`,
  `faqs`, `finalCta`, `footer`, `walkthrough`, `testimonials`, plus per-page
  objects (`aboutPage`, `contactPage`, `careersPage`, `legalPages`, …).
  Reordering a rail or renaming a card is usually a one-line change here.
- **`src/lib/modulePages.ts`** — the 12 product modules (`slug`, `icon`,
  `seo`, `hero.{kicker,title,lead}`, `walkthrough.steps[]`). Drives
  `/platform/[slug]`, the walkthrough hub and its directory. There is **no
  `name` field** — use `hero.title`.
- **`src/lib/searchIndex.ts`** — nav search corpus.
- **`src/lib/leads.ts`** — posts contact/footer forms to
  `NEXT_PUBLIC_API_BASE_URL ?? https://api.kaysetu.in/api`. Both forms are live
  lead capture; don't stub them out.
- `src/components/Icon.tsx` maps string names → lucide icons. Data files store
  icon **names as strings**; if you add one, add it to `Icon.tsx` too.

One data change can surface in several places — e.g. `operations.cards` feeds
both the numbered pipeline rail *and* the MagicBento grid under it.

---

## 5. Key components

| File | Role |
| ---- | ---- |
| `components/Nav.tsx`, `AnnounceBar.tsx`, `Footer.tsx` | Global chrome. |
| `components/PageChrome.tsx` | `PageShell` wrapper used by inner pages (`cta` prop toggles the closing CTA). |
| `components/blocks/hero-section-1.tsx` | Homepage hero + inline dashboard mockup. |
| `components/ModuleShowcase.tsx`, `Walkthrough.tsx` | Module tour (uses `ui/CardSwap`). |
| `components/Sections.tsx` | `Operations` backbone rail + section primitives (`Section`, `SectionHead`). |
| `components/CardSwapDemo.tsx` | Testimonials band (navy panel + avatar picker). |
| `components/ClosingCta.tsx` | Closing band above the footer, incl. the five-stop flow diagram. |
| `components/Motion.tsx` | `Reveal` (scroll-in) and `AutoMedia`. `Reveal` takes `className` + `delay`. |
| `app/walkthrough/page.tsx` | Hub: hero, `ModuleSwitcher` (client, `useSearchParams`), module directory. |

**Server vs client:** `app/walkthrough/page.tsx` is deliberately a server
component — `ModuleSwitcher` reads `useSearchParams`, which bails to client
rendering and would blank the static HTML if the whole page were a client
component. Keep the bailout confined inside `<Suspense>`.

---

## 6. Conventions

- **Comments explain *why*, not what.** The codebase is heavily commented with
  the reasoning behind non-obvious CSS ("`overflow-x: clip` not `hidden`,
  because `hidden` breaks sticky"). Match that register; don't strip them.
- Tailwind-only styling; no CSS modules. Long class strings are normal.
- `Reveal` wraps most above-the-fold blocks; stagger with `delay={i * 60}`.
- Grid children that hold text get `min-w-0`; long values get `truncate`.
- Interactive elements need `aria-label`, decorative layers `aria-hidden`.
- Prefer real `<Link>`s over button-driven navigation so crawlers can follow.

---

## 7. Verifying UI changes (no test suite)

1. **Dev server.** `npm run dev` from `KaySetu-Landing-Page-main`. Next bumps
   the port if one is taken — read the actual port from the output. In the last
   session the landing site was on **`http://localhost:3001`** (3000/3005 were
   other apps). Confirm with `curl -s localhost:PORT | grep KaySetu`.
2. **Playwright** is installed outside the project at Git Bash `/tmp/pw`
   (≈ `C:\Users\user\AppData\Local\Temp\pw`) with chromium in
   `~/AppData/Local/ms-playwright` — deliberately not a project dependency.
   Write a small `.mjs` there, `node script.mjs`. Screenshot paths must be
   Windows-absolute.
3. Attach `page.on('pageerror')` / `on('console')` — hydration and compile
   errors only show up there.
4. Check `document.documentElement.scrollWidth` at 430px wide: it must not
   exceed the viewport (horizontal-overflow regressions are the common bug).
5. A route returning **500** in dev is usually a real parse/compile error —
   fetch the page and read `__NEXT_DATA__.err.message` for the exact line. But
   a 500 mentioning *"Jest worker exceeding retry limit"* is a dev-server OOM,
   not a code bug: restart dev and confirm with `next build`.

---

## 8. Traps that have bitten before

- **Tailwind v4 `translate-*` classes stack with JS-written transforms.**
  `-translate-x-1/2` compiles to the native `translate` property, so an rAF loop
  setting `el.style.transform = "translate(-50%,-50%)"` *adds* to it → −100%
  shift. For imperatively animated elements, centre only via inline style.
- **`overflow-x: clip`, never `hidden`,** on the root — `hidden` makes the root
  a scroll container and kills every `position: sticky`.
- **Scroll-reveal is JS-gated** (`html.js .reveal { opacity: 0 }`); headless
  screenshots need a real wait or the shot is blank.
- **`next/image` + SVG**: the optimizer blocks SVGs; `next.config.ts` sets
  `dangerouslyAllowSVG` + `contentDispositionType: "inline"`. Pass
  `unoptimized` for `.svg` sources. Also, `next/image` often renders as a broken
  glyph in headless screenshots even when fine — verify the raw URL first.
- **JSX comments inside a `.map()` callback**: `items.map(x => ( {/* … */} <li>`
  is a parse error that 500s the whole route. Put the comment above the call.
- Padding on a `<main>` that ends in `<ClosingCta />` shows as a pale strip
  above the navy footer. Both known cases were fixed; don't reintroduce.

---

## 9. State as of this handoff

Recently completed and visually verified:

- **Contact page** — removed the "After you hit send / No black hole, no drip
  campaign" three-step section and its `contactPage.next` data.
- **Testimonials** (`CardSwapDemo.tsx`) — replaced the 3D card-swap deck with a
  navy panel + one-at-a-time testimonial and a clickable avatar picker
  (auto-advances 5.2s, pauses on hover). Background image removed. The
  `ui/CardSwap` component is still used by `ModuleShowcase`.
- **Walkthrough hero** — two-column: copy + CTAs on the left, a "Guided
  walkthrough" preview card (first four modules from `modulePages`) on the
  right; new `#module-directory` anchor.
- **ClosingCta** — fixed a parse error that was 500-ing the homepage; the flow
  diagram gained a caption, gradient stop cards and a filled navy hub disc.
- **Operations rail** — reordered to `INV → PURCH → PROD → BOOKS`
  (`operations.cards` in `content.ts`); lead sentence updated to match.

Open / unresolved:

- **Footer width on wide monitors.** The footer grid is `max-w-[1600px]` and
  measures a full 1600px; on a ~2560px display that leaves ~480px of navy each
  side. The user asked why that space isn't used — the decision (spread the
  footer edge-to-edge vs keep the 1600 cap that aligns with every section above
  vs widen the whole site) was **not made**. Ask before changing.
- `src/app/platform/[slug]/page.tsx` still uses the dead `bg-surface` class.
- Modern Romance font files are missing from `public/fonts/` (see §3).
