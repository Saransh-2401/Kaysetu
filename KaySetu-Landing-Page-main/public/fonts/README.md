# Fonts

## Modern Romance (display face — every heading on the site)

Modern Romance is a commercial font and is **not** on Google Fonts, so it has to
be self-hosted here. Drop the licensed file into this folder named exactly one of:

- `ModernRomance.woff2` ← preferred (smallest, best supported)
- `ModernRomance.woff`
- `ModernRomance.otf`
- `ModernRomance.ttf`

The `@font-face` block at the top of `src/app/globals.css` tries those four in
that order, so any one of them is enough — no code change needed. Until a file
is present, headings fall back to Cormorant Garamond and nothing breaks.

If you only have a `.otf`/`.ttf`, convert it for a much smaller download:

```
npx wawoff2 ttf2woff2 < ModernRomance.otf > ModernRomance.woff2
```

Headings pick this up through the `.font-display` class and the `--font-display`
theme variable — don't hardcode the family name in components.
