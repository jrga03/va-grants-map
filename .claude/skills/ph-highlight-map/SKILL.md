---
name: ph-highlight-map
description: Use when asked to produce a static Philippines map image or SVG with specific provinces highlighted, called out, recolored, or shaded — for decks, reports, one-pagers, or partner exports from this repo.
---

# PH Highlight Map

## Overview

Generates a standalone SVG of the Philippines with a chosen set of provinces
filled in a highlight color and everything else in a base color. Output is
self-contained — no CSS, no fonts, no JS — so it drops straight into Slides,
Figma, Canva, or a PDF.

Geometry is read from `src/components/PHSvg.jsx` at run time, so exports never
drift from what the React app renders. Do not hand-edit SVGs in `output/`;
regenerate them.

## When to Use

- "Map with X, Y, Z highlighted", "shade these provinces", "map for the deck"
- A one-off export with different brand colors than the app
- Refreshing an existing export after province geometry changed

**Not for:** changing colors _in the live app_ (that's
`src/components/PHSvg.module.css` and `src/components/Legend.jsx`), or the
grant-data-driven exports (that's `scripts/generate-static-svg.mjs`, which reads
partner regions from `constants.js`).

## Quick Reference

```bash
node scripts/generate-highlight-svg.mjs --provinces "Misamis Oriental,Quezon,Palawan"
```

| Input                  | Flag                                 | Default                       |
| ---------------------- | ------------------------------------ | ----------------------------- |
| Provinces to highlight | `--provinces "A,B,C"` (repeatable)   | _required_                    |
| Highlight fill         | `--highlight <color>`                | `#003850`                     |
| Default fill           | `--default <color>` (alias `--base`) | `#c9e9ea`                     |
| Stroke color           | `--stroke <color>`                   | same as `--highlight`         |
| Output path            | `--out <path>`                       | `output/ph-highlight-map.svg` |
| List valid provinces   | `--list`                             | —                             |

Colors accept `#rgb`, `#rrggbb`, `#rrggbbaa`, a CSS keyword, or `none`.
`--provinces` accepts names (`Quezon`), codes (`PH-QUE` or `QUE`), and current
names for provinces this dataset still lists under an older label.

Full flags: `node scripts/generate-highlight-svg.mjs --help`

## Province Vocabulary

The geometry predates several renamings and splits. The script auto-resolves
these and prints a `Resolved:` note showing the substitution — **read that note**,
it is the only signal that you got different geometry than you asked for:

| You may be given                   | Dataset label                 |
| ---------------------------------- | ----------------------------- |
| Davao de Oro                       | Compostela Valley             |
| Metro Manila, NCR                  | Metropolitan Manila           |
| North Cotabato                     | Cotabato                      |
| Occidental / Oriental Mindoro      | Mindoro Occidental / Oriental |
| Maguindanao del Norte _or_ del Sur | Maguindanao (undivided)       |

The Maguindanao rows are lossy: the dataset has one undivided shape, so either
half highlights the whole province. Say so rather than shipping it silently.

Unrecognized inputs are **all** reported together with suggestions, and nothing
is written — a failed run never leaves a stale or half-correct file behind.

## Verify Before Delivering

An SVG that parses is not an SVG that's correct — a typo'd name is caught, but
a plausible wrong province is not. Before calling it done:

1. Read the `Highlighted N/81:` line. Confirm the resolved names and count are
   what was asked for. If the denominator is not 81 the script aborts — the
   geometry format drifted, and no output is trustworthy until the regex is
   updated.
2. Render and **look at it**:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
     --disable-gpu --screenshot=preview.png --window-size=730,1220 \
     --default-background-color=FFFFFFFF "file://$PWD/output/ph-highlight-map.svg"
   ```
   Then open `preview.png` and confirm the highlighted shapes are where those
   provinces actually are. (No `rsvg-convert`/ImageMagick on this machine;
   headless Chrome is the working rasterizer.)

## Common Mistakes

- **Reusing the default `--out`** across several maps in one session — each run
  overwrites the last. Pass an explicit `--out` per variant.
- **Stroke left on the highlight color for a light palette.** The default makes
  highlighted provinces read as clean silhouettes, but it also draws every
  internal border in that dark color. For a lighter look pass `--stroke "#ffffff"`.
- **Highlight and stroke identical to `--default`** — renders a blank-looking
  map. The script won't stop you.
- **Assuming a region is a province.** Calabarzon, Bicol, and Soccsksargen are
  regions; this dataset is provinces only. Expand to member provinces.

## Known Data Quirk

Every province id is `PH-XXX` except Maguindanao, which is `PH_MG` (underscore,
two letters). `src/constants.js` keys `REGION_MAP` on that spelling, so it is
load-bearing — do not "correct" it. Any code matching ids must accept both
separators; a `PH-[A-Z]+` pattern silently drops Maguindanao and produces a map
with an invisible hole in central Mindanao.

Both generator scripts accept either separator and abort if the parsed region
count ever diverges from the source, so a future format drift fails loudly
instead of shipping a hole. Any new script that parses these ids must do the
same.

## Adding an Alias

New renaming? Add it to `ALIASES` in `scripts/generate-highlight-svg.mjs`
(lowercase key → exact dataset label) and note lossy split mappings here.
