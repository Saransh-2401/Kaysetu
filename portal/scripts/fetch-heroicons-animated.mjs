// Fetch the last few animated icons from heroicons-animated.com (Motion + Heroicons, MIT).
// RUN THIS YOURSELF (needs network):
//   node scripts/fetch-heroicons-animated.mjs
//
// Same as the lucide-animated script: downloads each /r/<slug>.json, extracts the
// .tsx, swaps "motion/react" -> "framer-motion" (already a dep), appends a default
// export, and writes to components/icons/local/heroicons-animated/<slug>.tsx.

import fs from "fs";
import path from "path";

const OUT = path.resolve("components/icons/local/heroicons-animated");
const BASE = "https://www.heroicons-animated.com/r";

// heroicons slugs for the icons lucide-animated lacked.
const names = ["printer", "scale", "stop"];

fs.mkdirSync(OUT, { recursive: true });

function extractTsx(json) {
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
console.log("\nNext: tell Claude it's done — it'll map Print/Scale/Stop to these.");
