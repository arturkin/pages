# Driving in Iceland — theory study project

## Mission

Turn nine scanned PDFs of the Icelandic driving-theory textbook into (1) a
readable, searchable HTML edition and (2) a study app that gets one person
through the theory test.

The source is **photographs of an open book** — no text layer, ~1–3% OCR error.
Everything downstream inherits that, so the governing rule is:

> **A missing card beats a wrong card.** Nothing ships that might teach something
> false. When a passage cannot be read confidently, it is skipped and the gap is
> recorded, not guessed at.

## Layout

```
*.pdf                 the nine source documents (read-only inputs)
brief.md              the original spec for the study app
README.md             the transcription pipeline — how and why
HANDOVER.md           status, what was fixed, what is knowingly left
practice/             OUT OF SCOPE (see below)

build/tools/*.swift   native OCR + crop tools, compiled binaries checked in
build/work/           all intermediate state (see "Regenerating" — it is derived)
build/qa/             review sheets and validation findings

pipeline/src/         TypeScript: layout → HTML, dataset, cards, tests
pipeline/cards/       authored questions (hand-written data, NOT derived)

site/                 the HTML edition          → open site/index.html
app/                  the study app             → open app/index.html
```

### `pipeline/src`

| File | Role |
| --- | --- |
| `layout.ts` | OCR lines + geometry → semantic blocks. The heart of it; most bugs live here. |
| `build-html.ts` | blocks → `site/` |
| `dataset.ts` | blocks → `build/work/dataset.json` (chapters → sections → chunks + signs) |
| `packets.ts` | dataset → authoring work packets |
| `cloze.ts` | rule-based number-fact extraction |
| `cards.ts` | authored packets + cloze + sign decks → `app/data`, with validation |
| `e2e.ts` / `e2e-app.ts` | the two test suites |
| `qa-sheets.ts`, `contactsheet.ts` | render sign contact sheets for visual review |

### `app`

Plain JS, no build step, no framework, must run from `file://`.
`js/sm2.js` scheduler · `js/store.js` persistence · `js/engine.js` selection and
exam · `js/ui.js` views. Details in `app/README.md`.

## Commands

```bash
npm run all          # full rebuild + both suites (~8 min; OCR is the slow part)

npm run ocr          # PDFs → page images + OCR JSON. WIPES build/work.
npm run figures      # crop pictures and signs, grade every crop
npm run build:html   # → site/
npm run dataset      # → build/work/dataset.json
npm run cards        # → app/data/
npm run test:e2e     # site: 197 checks
npm run test:app     # app: 99 checks
npm run typecheck

npm run packets      # re-cut authoring work packets
npm run qa:sheets    # sign contact sheets → build/qa/sheets/
```

## Rules for changing this project

**Thresholds are measured, not guessed.** Every numeric cutoff in `layout.ts` and
`cards.ts` has the distribution it came from in the comment beside it (sign
chroma, text coverage, crop aspect, caption-ghost height). Re-measure before
changing one — render a contact sheet and *look* at what the new rule would
catch. Two earlier guesses regressed the build.

**Never auto-correct OCR text.** This was tried and measured: of 166 proposed
single-edit "fixes", the top entries were `braking → broking` (27×),
`called → celled`, `parties → panties`. The remedy in place is the per-page
*View original scan* toggle plus published confidence.

**Write questions from the fact, never from the OCR string.** If a passage is
unreadable, skip it. `pipeline/cards/README.md` is the authoring contract and
`npm run cards` enforces it.

**Chunk ids are content-derived, not positional.** They were positional once, and
filtering 44 figure crops renumbered everything after them, silently dropping 75
citations. `test:app` now asserts no authored question is ever rejected.

**Test floors sit ~1 point under measured values on purpose.** If a floor fails,
investigate before lowering it — that is how the 180° page flip, the
justified-text mis-flip and the caption-crop bug were all caught.

**`practice/` is out of scope.** Its answer sheets are graphical (a stack of cells
with an `X` in one) and need geometric extraction, not OCR. Do not silently
revisit this.

## Regenerating

`build/work/` and `site/` and `app/data/` and `app/signs/` are **derived** — safe
to delete and rebuild. `pipeline/cards/*.json` and
`pipeline/cards/sign-exclusions.json` are **hand-made data**; losing them loses
real work.

`npm run ocr` wipes `build/work`, so `npm run figures` must follow it or
`build:html` reads a stale manifest.

After editing a `.swift` tool, recompile it — there is no build script:
`swiftc -O <name>.swift -o <name>` inside `build/tools/`.

## Where to pick up

`HANDOVER.md` has the current status and a ranked list of what is knowingly
unfinished.

**Column interleaving (C5) is done.** Lines are now clustered into columns before
ordering: `frameCut` sweeps for a vertical whitespace corridor with a straddle
tolerance, recursing once into each half, and `sameBaselineOrder` puts the
fragments of one typeset line back in `x` order. Cross-frame chunk contamination
went 11.2% → 0.94%, the longest `<figcaption>` 172 → 45 words, and ch-4 p.66's
speed limits are a citable prose chunk again. What is left of it is four measured
residuals, all recorded in `FIXES.md`:

- **C5-r1** — appendix p.165's right half, blocked by `CROSS_MAX = 3` against 4
  straddlers. Not depth, not ordering; depth 3 and 4 both change 0 partitions.
- **C5-r2** — the heading that page lost. A candidate fix was measured and
  rejected: it invented one heading and demoted another.
- **C5-r3** — sign-face legends ordered into mid-sentence. Four discriminators
  measured and rejected, crop containment among them. **Do not re-try those.**
- **C5-r4** — `extras.sort` re-scrambles what `sameBaselineOrder` fixed, so
  ch-4 p.54 is right within its column and wrong on the page.

The largest open items now are **C6/C10/C11, silent OCR omission** (~2.2% of
pages, one instance inverting a safety instruction — needs a full re-OCR, and
must not be batched with anything else) and **B10/B11 authoring**, which C5 has
now unblocked.
