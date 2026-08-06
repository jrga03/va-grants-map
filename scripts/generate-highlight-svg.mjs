// Generates a static SVG of the PH map with an arbitrary set of provinces
// highlighted. Province geometry is read from src/components/PHSvg.jsx, so the
// output always tracks the same paths the React app renders.
//
//   node scripts/generate-highlight-svg.mjs --provinces "Quezon,Palawan"
//   node scripts/generate-highlight-svg.mjs --list
//
// Run with --help for the full flag list.
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const DEFAULTS = {
  provinces: [],
  highlight: "#003850",
  default: "#c9e9ea",
  stroke: null, // falls back to the highlight color
  out: "output/ph-highlight-map.svg",
};

const USAGE = `
Usage: node scripts/generate-highlight-svg.mjs [options]

  --provinces "A,B,C"  Provinces to highlight. Repeatable; comma-separated.
                       Accepts names ("Quezon"), codes ("PH-QUE" or "QUE"),
                       and current names for provinces this dataset still
                       lists under an older label. See --list.
  --highlight <color>  Fill for highlighted provinces  (default ${DEFAULTS.highlight})
  --default <color>    Fill for everything else        (default ${DEFAULTS.default})
  --stroke <color>     Border color for all provinces  (default: same as --highlight)
  --out <path>         Output file, relative to repo root
                       (default ${DEFAULTS.out})
  --list               Print every valid province name and exit
  --help               Show this message

Colors accept #rgb, #rrggbb, #rrggbbaa, a CSS color keyword, or "none".
`.trim();

// ---------------------------------------------------------------- arg parsing

const opts = { ...DEFAULTS };
const argv = process.argv.slice(2);

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  const next = () => {
    const value = argv[++i];
    if (value === undefined) fail(`${arg} requires a value`);
    return value;
  };

  switch (arg) {
    case "--provinces":
      opts.provinces.push(...splitNames(next()));
      break;
    case "--highlight":
      opts.highlight = next();
      break;
    // --base is accepted as an alias so the flag reads naturally either way.
    case "--default":
    case "--base":
      opts.default = next();
      break;
    case "--stroke":
      opts.stroke = next();
      break;
    case "--out":
      opts.out = next();
      break;
    case "--list":
      opts.list = true;
      break;
    case "--help":
    case "-h":
      console.log(USAGE);
      process.exit(0);
    default:
      fail(`Unknown argument: ${arg}\n\n${USAGE}`);
  }
}

function splitNames(value) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// ------------------------------------------------------------- region parsing

const phSvgSrc = readFileSync(resolve(root, "src/components/PHSvg.jsx"), "utf8");

// Extract name, id and path data from the `data` array in PHSvg.jsx.
// Ids are mostly "PH-XXX" but Maguindanao is "PH_MG" — an inconsistency that
// constants.js depends on, so match both separators rather than "fixing" it.
const regionRegex =
  /name:\s*"([^"]+)",\s*\n\s*id:\s*"(PH[-_][A-Z]+)",\s*\n\s*d:\s*"([^"]+)"/g;
const regions = [];
for (const match of phSvgSrc.matchAll(regionRegex)) {
  regions.push({ name: match[1], id: match[2], d: match[3] });
}

// A province whose entry doesn't match the regex is dropped silently, yielding
// a map with a hole in it that still looks plausible. Compare against a raw
// count of name fields and refuse to emit if they disagree.
const declared = phSvgSrc.match(/^\s+name: "/gm)?.length ?? 0;
if (!regions.length || regions.length !== declared) {
  fail(
    `Parsed ${regions.length} regions but src/components/PHSvg.jsx declares ` +
      `${declared}. Its \`data\` array format changed — update regionRegex ` +
      `before trusting any output.`,
  );
}

if (opts.list) {
  for (const region of [...regions].sort((a, b) => a.name.localeCompare(b.name)))
    console.log(`${region.name}  (${region.id})`);
  process.exit(0);
}

// ---------------------------------------------------------------- validation

const COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/;
for (const key of ["highlight", "default", "stroke"]) {
  const value = opts[key];
  if (value !== null && !COLOR.test(value))
    fail(`--${key} "${value}" is not a color (want #rgb, #rrggbb, or a keyword)`);
}

const stroke = opts.stroke ?? opts.highlight;

if (!opts.provinces.length) fail(`--provinces is required\n\n${USAGE}`);

// The geometry in PHSvg.jsx predates several provincial renamings and splits,
// so accept the current names and map them onto the dataset's legacy labels.
// Splits point at the undivided parent — the geometry cannot represent them
// separately, which the warning below makes explicit.
const ALIASES = {
  "davao de oro": "Compostela Valley",
  "metro manila": "Metropolitan Manila",
  ncr: "Metropolitan Manila",
  "national capital region": "Metropolitan Manila",
  "north cotabato": "Cotabato",
  "northern cotabato": "Cotabato",
  "occidental mindoro": "Mindoro Occidental",
  "oriental mindoro": "Mindoro Oriental",
  "western samar": "Samar",
  "maguindanao del norte": "Maguindanao",
  "maguindanao del sur": "Maguindanao",
};

const byName = new Map(regions.map((r) => [r.name.toLowerCase(), r]));
// Codes are accepted with or without the "PH-" prefix: "PH-QUE" or "QUE".
const byCode = new Map();
for (const region of regions) {
  byCode.set(region.id.toLowerCase(), region);
  byCode.set(region.id.slice(3).toLowerCase(), region);
}

const highlightIds = new Set();
const notes = [];
const invalid = [];

for (const input of opts.provinces) {
  const needle = input.toLowerCase();
  const region =
    byName.get(needle) ??
    byCode.get(needle) ??
    byName.get(ALIASES[needle]?.toLowerCase());

  if (!region) {
    invalid.push({ input, near: suggest(needle) });
    continue;
  }

  // Surface anything that didn't match the dataset label verbatim, so a
  // renamed or code-based input is never silently substituted.
  if (region.name.toLowerCase() !== needle)
    notes.push(`  "${input}" -> ${region.name} (${region.id})`);
  highlightIds.add(region.id);
}

// Report every bad input at once — fixing them one run at a time is tedious
// when a whole list was pasted in.
if (invalid.length) {
  const lines = invalid.map(
    ({ input, near }) =>
      `  "${input}"` + (near.length ? ` — did you mean: ${near.join(", ")}?` : ""),
  );
  fail(
    `${invalid.length} of ${opts.provinces.length} inputs did not match a province ` +
      `name or code:\n${lines.join("\n")}\n` +
      `Run with --list to see all ${regions.length} valid names and codes.`,
  );
}

function suggest(needle) {
  const head = needle.split(/\s+/)[0];
  return regions
    .filter((r) => {
      const candidate = r.name.toLowerCase();
      const candidateHead = candidate.split(/\s+/)[0];
      return (
        candidate.includes(needle) ||
        needle.includes(candidate) ||
        r.id.slice(3).toLowerCase().startsWith(needle) ||
        candidateHead.startsWith(head) ||
        head.startsWith(candidateHead)
      );
    })
    .map((r) => `${r.name} (${r.id})`);
}

if (notes.length) console.warn(`Resolved:\n${notes.join("\n")}`);

// ------------------------------------------------------------------- emit svg

const paths = regions
  .map((r) => {
    const fill = highlightIds.has(r.id) ? opts.highlight : opts.default;
    return `    <path id="${r.id}" fill="${fill}" d="${r.d}"><title>${r.name}</title></path>`;
  })
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 730 1220">
  <g stroke="${stroke}" stroke-width="0.5" fill-opacity="1">
${paths}
  </g>
</svg>
`;

const outPath = resolve(root, opts.out);
writeFileSync(outPath, svg);

const highlighted = regions
  .filter((r) => highlightIds.has(r.id))
  .map((r) => `${r.name} (${r.id})`);

console.log(
  `Highlighted ${highlightIds.size}/${regions.length}: ${highlighted.join(", ")}\n` +
    `  highlight ${opts.highlight}  default ${opts.default}  stroke ${stroke}\n` +
    `Wrote ${outPath}`,
);
