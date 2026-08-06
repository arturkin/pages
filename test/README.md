# Driving in Iceland — scanned PDFs → readable HTML

Turns the scanned *Driving in Iceland* PDFs in this folder into a mobile-friendly
HTML edition with searchable text, cropped illustrations, and a per-page quality
report.

All OCR runs **on-device** through Apple's Vision framework — no network, no
third-party OCR dependency. Image handling is Core Graphics / PDFKit. The
orchestration and HTML generation are TypeScript.

## Run it

```bash
npm install
npm run ocr          # PDFs → deskewed page images + OCR JSON  (~7 min, 188 pages)
npm run figures      # crop pictures and signs, then grade every crop
npm run build:html   # → site/
npm run dataset      # → build/work/dataset.json (structured chapters/sections/chunks/signs)
npm run cards        # → app/data (authored questions + sign decks + cloze)
npm run test:e2e     # site: rendering + transcription checks
npm run test:app     # app: card data, scheduler, exam, flows
open site/index.html
open app/index.html
```

`npm run all` runs them in order.

Two other commands support the workflow rather than the build:
`npm run packets` cuts the book into authoring work packets, and
`npm run qa:sheets` renders sign contact sheets for visual review.

`npm run ocr` is the slow step and only needs re-running when a source PDF or a
native tool changes.

## What's in scope

The nine top-level PDFs: `Ch. 1–2`, `Ch. 3` … `Ch. 8`, `Appendix`, and
`umferdarmerki_enska` (the official traffic-sign sheet). The `practice/` folder is
deliberately excluded.

## Why it is built this way

The inputs are *photographs of an open book*, not digital documents, and several
of their properties break the obvious approach:

| Property of the source | Consequence |
| --- | --- |
| No text layer at all (0 characters in all 123 pages) | OCR is mandatory; there is nothing to extract |
| Page content overflows the declared `mediaBox` | Rendering via PDFKit silently truncates text, so the embedded photo is pulled at native resolution instead |
| One PDF page = a two-page spread | Pages must be split at the fold before layout makes sense |
| Pages tilt up to ~4° | Text lines must be levelled or line grouping falls apart |
| `/Rotate` is unreliable — chapters say 270 and mean it, the appendix says 0 but is stored sideways | Orientation is measured, not trusted |

## Pipeline

```
PDF
 └─ bookocr   embedded image at native resolution → orientation → background trim
              → gutter split → deskew → Vision OCR (two framings, merged)
                                                    ├─ build/work/pages/*.png
                                                    └─ build/work/ocr/*.json
 ├─ figures     ink outside the text boxes → merged illustration crops
 ├─ signs       colour + ink mask → one crop per sign (sign sheet + appendix)
 ├─ checkcrops  grade every crop: ok | cut | text-only | blank
 ├─ build-html  OCR geometry → columns, paragraphs, headings, picture captions;
 │              drops crops graded a non-picture, marks clipped ones
 │                                                  └─ site/
 ├─ dataset     the same layout blocks as machine-readable chapters → sections →
 │              chunks, each with an id, a topic tag and a source reference,
 │              plus every sign with its label and sheet section
 │                                                  └─ build/work/dataset.json
 └─ cards       authored questions + generated sign decks + rule-based cloze,
                validated against the dataset
                                                    └─ app/
```

The study app built on top of this is documented in [`app/README.md`](app/README.md).

### Native tools (`build/tools/*.swift`)

Each is a single self-contained file, compiled with `swiftc -O`.

- **`bookocr`** — the main pass. Per page: pull the largest embedded image at
  native resolution, decide the upright orientation, trim the photo background,
  find the gutter, split, deskew, then OCR. Emits page PNGs and per-page JSON with
  a line box, confidence and alternate readings for every text line.
- **`figures`** — masks out every recognized text box, treats the remaining ink as
  illustration, merges fragments of one picture, and crops them.
- **`signs`** — isolates each individual sign on the sign sheet and in the
  appendix's sign tables, where merging neighbours would fuse a whole row into one
  sliced strip.
- **`checkcrops`** — grades every crop. A correctly framed sign is surrounded by
  paper, so content on the border ring means it was sliced; a sign is one dominant
  shape, so many small blobs with no dominant component means the crop caught a
  caption instead of a graphic.
- **`probe` / `boxes` / `render` / `overflow` / `cropimg`** — small diagnostics kept
  because they are what established the facts in the table above.

### Four decisions worth knowing

**The gutter is found by the fold's shadow, not by whitespace.** Splitting on the
widest central gap picks the table-of-contents leader gap — wider than the real
gutter — and truncates the page-number column to `13`, `14`. Splitting on the
darkest column lands on the shadow's edge and shaves glyphs off the inner margin.
The fold is instead identified by the one signature no text column has: darkness
persisting down nearly every row while containing no glyph ink.

**OCR runs twice per page and the results are merged.** Vision's detector clips the
first glyph of lines starting near the image edge — `course` came back as `ourse`
at confidence 1.00. Adding a white quiet zone fixes that but causes small isolated
text (a page-number column) to be missed instead. Neither framing dominates, so
both run and the union is kept, preferring whichever reading is a superset.

**Orientation is decided per document, by majority vote.** `/Rotate` is wrong for
the appendix, and deciding per page let a handful of its spreads disagree with
their neighbours and come out upside down — which Vision hides, because it rotates
each line internally and returns clean words while the line *boxes*, and so the
reading order, stay inverted. Geometry fixes the axis (an upright spread is always
landscape), text alignment fixes which way up (short lines sit flush left), and a
document-wide vote stops one ambiguous page from disagreeing with the rest.

**Recognized text is never auto-corrected.** A dictionary-based repair pass was
built and measured, then discarded: of 166 single-edit "fixes" it proposed, the
top suggestions were `braking → broking` (27×), `called → celled`,
`needed → reeded`, `parties → panties`. The system word list lacks inflected
forms, so "not a word" is not evidence of an OCR error, and the pass would have
corrupted correct text. Every page therefore links to its original scan, and
per-page confidence is published.

## Output

`site/` — `index.html`, one page per document, `qa.html`, plus `figures/` and
`scans/`. Self-contained and openable from disk.

Each transcribed page carries its book folio, running head, mean OCR confidence
and a **View original scan** toggle, so any passage can be checked against the
photograph it came from. Blocks recognized below 60% confidence are tinted.

## Verification

Two suites, 274 checks. `npm run test:app` covers the study app and is described
in [`app/README.md`](app/README.md).

`npm run test:e2e` serves `site/` and drives headless Chromium at 390×844 and
1280×900, asserting:

- **Rendering** — HTTP 200, no console errors, no failed requests, no broken
  images, no horizontal overflow, non-trivial text on every page.
- **Transcription** — passages transcribed by eye from the scans must appear
  verbatim; the contents page-number column must survive (a direct regression test
  for the gutter split); running heads must not leak into prose.
- **Lexicon coverage** — share of prose tokens that are real English words, with
  inflection handled, held to a floor per document. Measures 96.6–99.4% for the
  chapters. Because the floors sit just under the measured values, a regression in
  OCR or layout trips them.
- **Structure** — page count, mean confidence, and that every referenced image
  exists on disk.
- **Crop quality** — no crop graded `text-only` or `blank` is published as a
  picture, every `cut` crop is visibly marked, and clipped crops stay under 10% of
  those published.

## Known limitations

- Roughly 1–3% of words in the chapters carry OCR errors from the photographs
  (`sass` for "pass", `pronibited` for "prohibited"). Deliberately not
  auto-corrected — see above. The scan toggle is the remedy.
- 634 of 1,125 published pictures carry the text printed with them. The rest have
  no nearby caption in the source (the appendix's per-sign crops especially
  outnumber its printed descriptions); they are outlined with a dashed border
  rather than silently dropped.
- 71 crops (6.3%) have content touching an edge and may be clipped. They are
  published with an amber outline, so a reader can fall back to the page scan.
- On the sign sheet, one label is printed for a group of related signs; members
  of such a group inherit it, shown with a `↳` marker.
