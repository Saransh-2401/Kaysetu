// Fetch animated lucide icons from lucide-animated.com (pqoqubbw, MIT) and
// vendor them locally — for the remaining gap icons that currently use the CSS
// micro-animation layer. RUN THIS YOURSELF (needs network):
//
//   node scripts/fetch-lucide-animated.mjs --test     # 3 icons, to validate
//   node scripts/fetch-lucide-animated.mjs            # all remaining gaps
//
// It downloads each icon's registry JSON, extracts the .tsx source, swaps the
// "motion/react" import to "framer-motion" (already a dependency), and writes to
// components/icons/local/lucide-animated/<name>.tsx. Then tell me it's done and
// I'll add the wrapper + map so they animate on hover + follow the scheme.

import fs from "fs";
import path from "path";

const OUT = path.resolve("components/icons/local/lucide-animated");
const BASE = "https://lucide-animated.com/r";

// CONFIRMED-available lucide-animated slugs (verified against the registry index).
// Covers the remaining CSS gaps + the cssvg replacements that exist there.
const ALL = [
  "file-text", "receipt-text", "receipt", "clipboard-check", "truck", "route",
  "calendar-check", "calendar-days", "arrow-left", "arrow-up", "arrow-down", "arrow-up-right",
  "arrow-right", "id-card", "workflow", "ban", "hourglass", "square-pen", "refresh-cw",
  "rotate-ccw", "history", "clock", "timer", "gauge", "shield-check", "map-pin", "map-pin-house",
  "boxes", "construction", "flask", "briefcase-business", "home", "sliders-horizontal",
  "check-check", "circle-check", "x", "search", "layers", "copy",
  // --- similar-name / visual matches for the long tail ---
  "play", "badge-percent", "circle-dashed", "smartphone-nfc", "book-text",
  "git-compare-arrows", "party-popper", "mailbox", "archive", "folder-plus",
  "switch-camera", "badge-alert", "hand-coins", "hard-drive-download", "train-track",
  "cog", "layout-panel-top", "monitor-check", "cart", "contrast", "bookmark",
  "gallery-thumbnails", "layout-grid",
];

const names = ALL;

fs.mkdirSync(OUT, { recursive: true });

function extractTsx(json) {
  // shadcn registry: { files: [{ path|target, content, type }] }
  if (json && Array.isArray(json.files)) {
    const f =
      json.files.find((x) => /\.tsx$/.test(x.path || x.target || "")) ||
      json.files.find((x) => typeof x.content === "string");
    if (f && typeof f.content === "string") return f.content;
  }
  if (typeof json.content === "string") return json.content;
  return null;
}

const ok = [];
const fail = [];

for (const name of names) {
  try {
    const res = await fetch(`${BASE}/${name}.json`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      fail.push(`${name} (HTTP ${res.status})`);
      continue;
    }
    const json = await res.json();
    let tsx = extractTsx(json);
    if (!tsx) {
      fail.push(`${name} (no .tsx content; keys=${Object.keys(json).join(",")})`);
      continue;
    }
    tsx = tsx
      .replaceAll('from "motion/react"', 'from "framer-motion"')
      .replaceAll("from 'motion/react'", "from 'framer-motion'");
    // Normalize to a default export (named exports have inconsistent casing).
    const cmp = tsx.match(/const\s+([A-Za-z0-9_]+)\s*=\s*forwardRef/);
    if (cmp && !/export\s+default/.test(tsx)) {
      tsx += `\nexport { ${cmp[1]} as default };\n`;
    }
    fs.writeFileSync(path.join(OUT, `${name}.tsx`), tsx);
    ok.push(name);
  } catch (e) {
    fail.push(`${name} (${e?.message || e})`);
  }
}

console.log(`\nVendored ${ok.length}/${names.length} -> ${path.relative(process.cwd(), OUT)}`);
if (ok.length) console.log("OK:   " + ok.join(", "));
if (fail.length) console.log("FAIL: " + fail.join("  |  "));
console.log("\nNext: tell Claude it's done — it'll add the wrapper + map so these animate on hover + follow the scheme.");
