// One-off codemod: swap default @mui/icons-material imports to the central
// animated-icon barrel. Usage of the icons (JSX/props) is unchanged.
//   node scripts/codemod-icons.mjs            (apply)
//   node scripts/codemod-icons.mjs --dry      (report only)
//
// Only migrates icons the barrel actually exports; anything else is LEFT on MUI
// and reported, so the codemod can never produce a broken import.

import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry");
const root = path.resolve(".");
const BARREL = "@/components/icons";

// Available barrel exports: names X where `export const XIcon = makeIcon(...)`.
const barrelSrc = fs.readFileSync(path.join(root, "components/icons/index.tsx"), "utf8");
const AVAILABLE = new Set(
  [...barrelSrc.matchAll(/export const (\w+)Icon = makeIcon/g)].map((m) => m[1])
);

const IMPORT_RE = /^\s*import\s+(\w+)\s+from\s+["']@mui\/icons-material\/(\w+)["'];?\s*$/;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes(path.join("components", "icons")) || entry.name === "node_modules") continue;
      walk(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const targets = [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))];

let filesChanged = 0;
let importsMigrated = 0;
const missing = new Map(); // path -> count

for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  const migrate = []; // { local, mui }
  const removeIdx = new Set();
  let firstIdx = -1;

  lines.forEach((line, i) => {
    const m = line.match(IMPORT_RE);
    if (!m) return;
    const [, local, mui] = m;
    if (!AVAILABLE.has(mui)) {
      missing.set(mui, (missing.get(mui) || 0) + 1);
      return; // leave on MUI
    }
    migrate.push({ local, mui });
    removeIdx.add(i);
    if (firstIdx === -1) firstIdx = i;
  });

  if (migrate.length === 0) continue;

  // Build deduped specifiers.
  const seen = new Set();
  const specs = [];
  for (const { local, mui } of migrate) {
    const key = `${mui}:${local}`;
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push(local === `${mui}Icon` ? `${mui}Icon` : `${mui}Icon as ${local}`);
  }
  const barrelImport = `import { ${specs.join(", ")} } from "${BARREL}";`;

  const out = [];
  lines.forEach((line, i) => {
    if (i === firstIdx) out.push(barrelImport);
    if (removeIdx.has(i)) return;
    out.push(line);
  });

  importsMigrated += migrate.length;
  filesChanged += 1;
  if (!DRY) fs.writeFileSync(file, out.join("\n"));
}

console.log(`${DRY ? "[DRY] " : ""}Files changed: ${filesChanged}, imports migrated: ${importsMigrated}`);
if (missing.size) {
  console.log(`Unmigrated (not in barrel) — left on MUI:`);
  for (const [name, count] of [...missing.entries()].sort()) console.log(`  ${name} (${count})`);
} else {
  console.log(`All MUI icon imports were covered by the barrel.`);
}
