// Regenerates the grant-data-driven map exports in output/. Partner regions are
// read from REGION_MAP in constants.js and province geometry from PHSvg.jsx, so
// both files track the app's own data.
//
//   node scripts/generate-static-svg.mjs
//
// For ad-hoc maps with a hand-picked province list and custom colors, use
// scripts/generate-highlight-svg.mjs instead.
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const phSvgSrc = readFileSync(resolve(root, "src/components/PHSvg.jsx"), "utf8");
const constantsSrc = readFileSync(resolve(root, "src/constants.js"), "utf8");

// Ids are mostly "PH-XXX" but Maguindanao is "PH_MG". Both patterns below must
// accept either separator — a "PH-" only pattern silently drops it from the
// geometry AND from the partner set, yielding a map with a hole in Mindanao.
const ID = "PH[-_][A-Z]+";

// Extract regions: name, id, d from the data array in PHSvg.jsx
const regionRegex = new RegExp(
  `name:\\s*"([^"]+)",\\s*\\n\\s*id:\\s*"(${ID})",\\s*\\n\\s*d:\\s*"([^"]+)"`,
  "g",
);
const regions = [];
for (const match of phSvgSrc.matchAll(regionRegex)) {
  regions.push({ name: match[1], id: match[2], d: match[3] });
}

// A province whose entry doesn't match the regex is dropped silently and the
// output still looks plausible. Cross-check against a raw count of name fields.
const declared = phSvgSrc.match(/^\s+name: "/gm)?.length ?? 0;
if (!regions.length || regions.length !== declared) {
  throw new Error(
    `Parsed ${regions.length} regions but PHSvg.jsx declares ${declared}. ` +
      `Its data array format changed — update regionRegex before trusting output.`,
  );
}

// Extract partner region IDs — only top-level keys of REGION_MAP, which appear
// as a bare `"PH-XXX",` line (the first element of each [key, value] tuple).
const mapStart = constantsSrc.indexOf("export const REGION_MAP ");
const mapSection = constantsSrc.slice(mapStart);
const partnerIds = new Set();
for (const match of mapSection.matchAll(new RegExp(`^\\s*"(${ID})",\\s*$`, "gm"))) {
  partnerIds.add(match[1]);
}

const unknown = [...partnerIds].filter((id) => !regions.some((r) => r.id === id));
if (unknown.length) {
  throw new Error(
    `REGION_MAP references ids with no matching geometry: ${unknown.join(", ")}`,
  );
}

console.log(`Regions: ${regions.length}, partner regions: ${partnerIds.size}`);

const BASE = "#cccccc";
const STROKE = "#ffffff";

const hkiIds = new Set(["PH-NUE", "PH-SOR", "PH-CAP", "PH-NER", "PH-LAN"]);

// The two exports differ in highlight color and whether HKI provinces are
// broken out in their own color.
const VARIANTS = [
  { out: "output/ph-grants-map.svg", highlight: "#0e3c60", hki: null },
  { out: "output/ph-grants-map-hki.svg", highlight: "#007789", hki: "#7a4183" },
];

for (const variant of VARIANTS) {
  const counts = { highlight: 0, hki: 0, base: 0 };

  const paths = regions
    .map((r) => {
      let fill = BASE;
      let bucket = "base";
      if (variant.hki && hkiIds.has(r.id)) {
        fill = variant.hki;
        bucket = "hki";
      } else if (partnerIds.has(r.id)) {
        fill = variant.highlight;
        bucket = "highlight";
      }
      counts[bucket]++;
      return `    <path id="${r.id}" fill="${fill}" d="${r.d}"><title>${r.name}</title></path>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 730 1220">
  <g stroke="${STROKE}" stroke-width="0.5" fill-opacity="1">
${paths}
  </g>
</svg>
`;

  const outPath = resolve(root, variant.out);
  writeFileSync(outPath, svg);
  console.log(
    `Wrote ${outPath}\n` +
      `  partner ${counts.highlight}` +
      (variant.hki ? `, hki ${counts.hki}` : "") +
      `, base ${counts.base}`,
  );
}
