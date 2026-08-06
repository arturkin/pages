# Handover — Iceland driving theory: PDFs → text edition → study app

State as of 2026-08-06, end of the **fifth** working session. `README.md` documents the
transcription pipeline, `app/README.md` the study app, and **`FIXES.md` is the ranked
worklist** — it carries every open item with its severity, measured evidence, the files
it touches, and the check that says it is done. This file is the status and the
orientation; `FIXES.md` is what you work from.

**The project moved this session.** It now lives at `~/Work/pages/test`, inside the git
repo `~/Work/pages` (`github.com/arturkin/pages`, a GitHub Pages site). `test/` is
**not yet tracked** and nothing has been committed or pushed. Read "Publishing" below
before you change that — there is a leak to avoid.

## Where things stand

| | |
| --- | --- |
| Documents transcribed | 9 (`Ch. 1–2`, `Ch. 3`–`Ch. 8`, `Appendix`, `umferdarmerki_enska`) |
| Book pages | 188, mean OCR confidence 97.5% |
| Word accuracy | 96.6–99.4% chapters, 94.6% sign sheet |
| Study cards | **767** — 247 authored MCQ, 6 cloze, 514 sign, 27 exclusions |
| Dataset | 91 sections · 1,938 chunks · 357 signs |
| `npm run test:e2e` | **197 green** |
| `npm run test:app` | **99 green** (was 97 — two regression tests added) |
| `npm run cards -- --strict` | exit 0 |
| `npm run typecheck` | clean |

All independently re-verified green this session. **No floor was ever lowered.** 1 check
was added this session (196 → 197: the tail-omission allowlist assertion); the running
total across all sessions is 20.

Rebuild from clean with `npm install && npm run all` (~8 min; OCR is the slow part).

## What landed this session — C5 and B12, both complete

Five changes, each implemented by a subagent, reviewed, and put through a fix round. The
decision-by-decision record with every measurement is
`.superpowers/sdd/plan-column-interleaving/progress.md` (228 lines) — **read it before
re-opening any decision below**, because several candidate fixes were measured and
rejected, and the measurements are the reason.

### C5 — column interleaving (`FIXES.md` C5, ✅ with four residuals)

Executed from `build/qa/validation-2026-08-05/plan-column-interleaving.md`, in the four
stages that plan lays out. `detectColumns` is **gone**; lines are now clustered into
frames *before* being ordered.

- **`frameCut`** in `layout.ts` sweeps for a vertical whitespace corridor with a straddle
  tolerance, recursing once into each half (`WIDE 0.60, LO 0.22, HI 0.78, STEP 0.0005,
  CROSS_MAX 3, GAP_MIN 0.004, MIN_LINES 2, MIN_CHARS 15, VERTICAL_DEPTH 2`).
- **`sameBaselineOrder`** in `mkColumn` puts the fragments of one typeset line back in `x`
  order (`0.75 · min(h)` vertical overlap, x-overlap ≤ 0.012, consecutive x-gap ≤ 0.03).
- An **ordered-list run break** in `paragraphize`: a run ends when the printed enumerator
  is not `previous + 1`, and each block still takes its `start` **verbatim**. It never
  infers a start — it only declines to merge.
- Measured effect: cross-frame chunk contamination **11.2% → 0.94%**, longest
  `<figcaption>` **172 → 45 words**, ordered-list items numbered wrongly **0**.
- **The prize landed.** ch-4 p.66's speed limits — 50 and 30 km/h, and the 90%/20%
  pedestrian-survival figures, the book's most-tested numbers — were a 172-word
  `<figcaption>` with no citable chunk at all. They are now `ch-4:15a:1j4ltjx`, 940
  characters, `kind: para`, cited by three cards.
- Cost, paid in the same change: **32 citations re-pointed, 2 dropped**. Stage 3 moved one
  more (`ch-8-b-11`).

Stage 3 reorders words, so it was held to a page-by-page reading: **12 of 21 pages
improved, 6 neutral, 3 slightly worse**. All three regressions were read against the page
photographs and are *visible garbage* rather than plausible-but-wrong — `Appendix-p008b`
(`(2.8ml`, `BREID GONG`), `Ch. 5-p005b` (a stray `'s`), `Ch. 8-p009b` (a contiguous
first-aid sentence split, which is what cost `ch-8-b-11` its citation). None alters a
fact, a number, or a card.

### B12 — sign labels and deck recovery (`FIXES.md` B12, ⚠️ mostly done)

27 label corrections applied, every one **read off a page band at 3–12×**, never inferred
from the OCR string. Six exclusions removed. `CLEAN_LABEL` length bounds widened
`{4,70}` → `{3,77}`, which admits exactly two labels (`Bank` at 4 characters, and one
77-character caption) — measured over all 357, with cap-90 and a charset widening both
tested and rejected.

- Deck **252 → 263 signs**, then **263 → 262** after one re-exclusion (below).
- **20 of 22 new cards land outside Service**, which is what B11's inverted weighting
  needed. Lane markings 3 → 5, Road markings 8 → 11, Supplementary 28 → 31.
- `p010full-s007` was recovered and then **deliberately re-excluded**. It and in-deck
  `p010full-s004` depict the same physical marking, and neither *label* names the visible
  difference, so a learner could only succeed by memorising crop artefacts. Cost 2 cards;
  the reasoning is in the exclusion's `reason` field and a later reader can overturn it by
  deleting the entry. Its label correction stays recorded — that is why the two sign files
  deliberately disagree.

## What landed this session — the OCR Stage 0 fix round closed, and OCR-omission Stage 1

Two pieces of work, both independently re-verified: `npm run test:e2e` 197/197,
`npm run cards -- --strict` exit 0, `npm run typecheck` clean, `npm run test:app`
97/97, deck 776 (247 MCQ / 5 cloze / 524 sign).

### The Stage 0 fix round (last session's three open findings) is closed

All three findings the previous handover left open were applied, none deferred:

1. **The stale-allowlist warning now asserts.** `omissionScan()` in `e2e.ts` gained
   `check('tail-omission allowlist has no stale entries', om.staleAllowlist.length === 0)`.
   Suite 196 → 197. Forgetting to empty `TAIL_OMISSION_ALLOWLIST` after a stage now fails
   the build instead of logging past it.
2. **The right-overlap gate's comment now states what it actually does**, not what it was
   meant to do: of its 116 rejections only 9 are true same-line fragments; 107 are lines
   whose right-hand neighbour is a different block — near-zero recall on sidebar-heavy
   pages. The gate stays (it misses, it never invents); the cost is now written down next
   to it instead of implied.
3. **The five undocumented cutoffs were re-measured live against the corpus, and no value
   changed** — this was a documentation fix, not a retuning:
   - cluster gap 0.05 → population 1,336 / 1,332 / 1,259 / 1,135 / 1,109 across 0.02–0.12
   - `cluster.length < 6` → population flat at 1,259 for 3–8, drops only at 10
     (columns 184 → 180); not load-bearing
   - `measure < 0.12` → 1,259 → 1,257 across 0.06–0.2; effectively inert
   - `refs.length < 3` → 1,267 → 1,240 for n = 1–5, mostly trading columns 337 → 156
   - signal-1 pitch band 0.55–1.45 → 1,265 → 1,211 across [0.4, 1.6] → [0.7, 1.3]
   - the reference-line `length >= 4` clause is **completely inert** — 3,256/3,256 lines
     survive it, removes 0.

`CLAUDE.md`'s check count is corrected to 197.

### OCR-omission Stage 1 (`FIXES.md` C6/C10/C11) — landed and green

`better()` in `build/tools/bookocr.swift` gained symmetric prefix-superset handling,
gated on an alphanumeric tail (`hasAlnum`) — the ungated variant and a bare tail-length
threshold were both measured and rejected. A full re-OCR + rebuild was run, not simulated.

- **The §0 harness was run for real.** A copy of the unedited OCR path reproduced 188/188
  shipped OCR JSONs exactly (text + geometry to 1e-9), and a full PDF→PNG→OCR re-run of
  `Ch. 6.pdf` came back byte-identical. Only then was the edited path run.
- **Measured:** 36 pages changed text (plan predicted 36); **+404 net chars against a
  predicted +396 — an 8-character divergence, flagged, not rationalised, and not
  compensated for anywhere.** Lines 9,351 → 9,351 (unchanged); chunks 1,944; sections 91;
  sign ids 357 match / 0 moved; contents folios 79/83 = 95.2%.
- `TAIL_OMISSION_ALLOWLIST` was emptied — Stage 1's regression signal fired as designed,
  and the new assertion above is what will catch it going stale again.
- **All 9 broken citations were re-pointed**, each confirmed by reading the successor
  chunk's actual text, none dropped: `ch-1-2-a-20`, `ch-4-b-06`, `ch-4-c-05`, `ch-5-a-13`,
  `ch-6-b-14`, `ch-6-b-15`, `ch-6-b-17`, `ch-8-a-16`, `ch-8-a-17` (the last two both moved
  from `ch-8:5b:r2knjh` to `ch-8:5b:1udnxuy`).
- **`ch-6-b-17` was the plan's flagged-ambiguous case**: its new chunk opens mid-sentence
  (`ich in for inspection`), traced to a pre-existing dataset chunk-boundary split between
  `ch-6:11b:1ftj449` and `ch-6:11b:nze0jt` — not caused by Stage 1. The tested fact is
  verbatim and unambiguous in the new chunk, so it was re-pointed rather than dropped.
  **Worth a human glance**, recorded here as one, not resolved further.
- **What Stage 1 does not touch:** ch-6 p.101's safety instruction (C6's headline case) is
  still missing — the `better()` prefix-superset theory was already known to be refuted
  for that line (see `FIXES.md` C6/C11). Only Stage 3 restores it.
- **New trap, recorded below too:** `cards.ts --strict` **fails closed** — it exits before
  writing `app/data/`. A stale `app/data/` from before this rebuild would have made
  `test:app` look green regardless of the OCR change; the rebuild was confirmed to
  regenerate `app/data/` before trusting the suite.

### OCR-omission Stage 2 (`FIXES.md` C6/C11) — landed and green, with a measured extension the plan did not contain

The plan's literal Stage 2 — best-first 1:1 pairing on separate y/x dominance
(`Y_MIN 0.60`, `X_MIN 0.50`), replacing `overlaps()` — was implemented, and **every
predicted number diverged**: 18 pages changed vs a predicted 65, −64 net chars vs +587,
chunks 1,944 → 1,936 vs a predicted → 1,930, 0 sign ids moved vs a predicted 3, 3 broken
citations vs a predicted 12, duplicate pairs 42 → 39 vs a predicted → 38. The divergence
is recorded as unexplained-but-real, not rationalised: **the plan's Stage 2 effect-size
predictions should not be trusted**, and Stage 3's are now equally suspect.

- **Why: a structural gap in the plan's 1:1 model — one-to-many fragment collisions.**
  On `Ch. 1–2-p007b` one OCR pass read "the administration's information- and service
  line" as ONE box, the other split it into THREE. All three clear the gate; a MIDDLE
  fragment won the greedy claim, failed `better()`'s prefix/suffix test, won the
  confidence tie, and destroyed the fused reading while locking out the two fragments
  that would have restored it.
- **The extension, measured first.** Corpus-wide: 662 fan-out collisions (fan-out
  2/3/4+ = 548/110/4). The x-order single-space concatenation reproduces the one-box
  text **exactly modulo whitespace in 51 cases, modulo-whitespace-only in 0, and not at
  all in 611**. All 51 were read by hand and are genuine same-line splits; the 611
  include marginal headings colliding with body lines and never coincide. Exact-join is
  a clean discriminator with no observed false-positive path. **The rule:** for a box
  with ≥2 gate-passing candidates, join in x-order and compare whitespace-collapsed; on
  exact match claim all fragments and keep the fused reading; everything else falls
  through to the 1:1 path. `better()`'s Stage-1 alnum gate is untouched.
- **Post-extension measured state**, against the pre-Stage-2 baseline: 53/188 pages
  changed, net −721 chars, lines 9,351 → 9,290, chunks 1,944 → 1,907, sections 91 → 92,
  sign ids 357 match / **0 moved**, duplicate pairs 42 → 38. 11 citations re-pointed,
  each confirmed by reading the successor chunk, none dropped (files: ch-4-b, ch-4-c,
  ch-5-b, ch-6-b, ch-7-a).
- **An independent adversarial audit of the "no text lost" claim** classified all 72
  removed line-instances: **68 redundant** (contained verbatim in a surviving line),
  **1 borderline punctuation-only** (a stray `• 97`, correctly dropped), **3 not
  contained**. The character budget reconciles exactly: 1,069 removed − 348 added = 721;
  72 − 11 = 61 lines. The 3:
  1. `'84 DRIVINGINICELAND'` (Ch. 5-p005a) — false alarm; the baseline glued two page
     elements with no space, the change correctly splits them into `'84'` +
     `'DRIVING IN ICELAND'`. An improvement.
  2. `'Mosfelisbaer'` (Appendix-p006b, conf 0.30) — one of ~5 garbled misreadings of
     "Mosfellsbær" on one sign-legend figure; same lexical content, a distinct physical
     instance.
  3. `'or sit people heart'` (Ch. 7-p002b, conf 0.50) — nonsense between two intact
     prose lines, genuinely gone. **Proven not caused by the fusion extension** — an
     isolated old-vs-new merge simulation on that page gives identical output with and
     without the rule. It is an artifact of Stage 2's own best-first tie-break.
  The honest framing: the zero-loss claim holds for **69 of 72**, not all 72; no lost
  line is book prose and none is cited.
- **New artifacts, harmless, recorded not fixed:** a spurious duplicate line on
  Ch. 7-p002b and a duplicate `DRIVING IN ICELAND` header on Ch. 5-p011b. Also: `'84'`
  on Ch. 5-p005a has alts `["8","4"]` — produced by the fusion rule gluing two real
  adjacent digit detections, so it is technically assembled rather than a single
  verbatim read. Within the rule's design, worth knowing.
- **Suites:** `test:e2e` 197/197, `cards --strict` exit 0 (776 cards — 247 MCQ / 5
  cloze / 524 sign), `typecheck` clean, `test:app` 97/97. No floor, threshold or
  constant was adjusted anywhere.

### OCR-omission Stage 3 (`FIXES.md` C6/C10/C11) — landed and green. The OCR-omission sweep is closed.

`OCR_PAD` gained a third framing (`[0.04, 0, 0.02]`); `ocr()` was refactored into a
reusable `mergeTwo(padded:, plain:)` folded across all pad values; and a new
`dedupContained()` post-pass implements the plan's containment dedup, including the
equal-text case at ≥ 0.5 y-overlap. `e2e.ts`'s whole-line-omission review-queue
ceiling was tightened 8 → 3 per plan §6.2 (a tightening, not a lowering; actual is 1).

**The prize: the safety instruction is restored.** `Ch. 6-p003b` (p.101) now reads
at conf 1.00, confirmed in `site/ch-6.html` and re-verified against the source scan
by an independent auditor: "…the battery might explode. For this reason, we must be
extremely careful and **avoid having our head positioned above the battery** when
making the connections." `ch-6-a-13` now cites `ch-6:3b:vdzyag`, which carries it
verbatim. The inversion — "we must be above the battery" — is gone. **This was the
last remaining item in the project that could teach something false.**

**A real-text-deletion bug in the plan's own rule, found and fixed.** Implemented
literally (y-overlap only), `dedupContained()` deleted real text: on multi-column
sign contact sheets (e.g. `umferdarmerki_enska-p002full`, four "Dangerous bend"
signs in one y-row) it collapsed 4 identical captions to 1, and dropped "to
right"/"to left" as false containment hits against a different sign's "first to
right"/"first to left" at the same y but a different x. Symptom in the first
rebuild: 63 sign ids gone / 84 new / 0 re-pointed against ~5 predicted. Fix: an
x-overlap requirement reusing the pipeline's own existing `X_MIN = 0.50` rather than
a new guessed constant. After the fix the four signs and both direction lines are
byte-identical to baseline and sign churn is 2. **Record this prominently — the
plan's stage-3 rule as written is unsafe, and the plan's own per-instance
verification of its 19 apparent losses did not catch it.**

**Actual vs predicted** (predictions again unreliable, though closer than stages
1–2 once the geometry bug was fixed): pages changed 121 → **89**; net lines +11 →
**+51**; net chars +279 → **+300**; chunks 1,940 → **1,907→1,938**; sections
91→90 → **92→91**; sign ids moved ~5 → **2**; broken citations 37 cumulative / 22
hand-read → **23, all hand-read, 0 dropped**; whole-line-omission queue ≤3 →
**1** (`Ch. 5-p007a`, the predicted tilt artefact).

**Independent adversarial audit of the no-loss claim** (recomputed from scratch,
all 188 pages, source page images cropped at 3–4× for the ambiguous cases). Diff
confirmed exactly: 81 changed pages, 72 removed / 123 added lines, budget
reconciles to +51 lines / +300 chars both ways. Classification: 55 plainly
contained, 2 contained modulo punctuation, **15 not contained** (the auditor's
split differs from the implementer's 55/11/6 but totals identically at 17). Every
one of the 15 was checked individually: garbled multi-line smears whose content is
fully covered by surviving clean lines, or OCR noise hallucinated off graphics
(`'Sas'` sits on a dashed lane-line diagram, `'L19'` on a sign pictogram, and `'4'`
on `Ch. 1–2-p005a` is a faint mark in the binding gutter with no textual survivor
at all). **No removed line carries a word, number, negation or clause absent from
its page's surviving text.** The x-gate was verified to have eaten no distinct
repeated caption.

**Deck: 776 → 775** — 247 authored MCQ, **6 cloze** (was 5), **522 sign** (was
524). The 2 sign cards are the orphaned id below. Cloze 5→6: all prior facts
preserved under shifted per-chunk indices plus one legitimately new "2 years" fact
from the newly-merged `ch-1-2:5a:q52h9l` — not a defect.

**Sign ids — 2 moved, `--update-ids` run deliberately after confirming both by
hand.** `umferdarmerki-enska:5full:qkl7e4` orphaned (successor label garbled,
auto-excluded by `CLEAN_LABEL`, no card ships under it — study history lost,
nothing misattributed). `…:6full:1ksslu7` → `1pbomoc` ("Sports" → "Sports centre",
same sign, better label, shipped). Orphaning was accepted; misattribution would not
have been.

**Suites, verified independently in the final tree:** `test:e2e` 197/197,
`cards --strict` exit 0 (775 cards), `typecheck` clean, `test:app` 97/97 on first
run (no flake this time — but the flaky-check trap below stands). No floor,
threshold or constant was lowered anywhere across stages 1–3.

**Left over from this stage, for human review, not fixed here:**
- Figure and sign crop counts drifted (figures 381→377, signs 912→908, ~4 items
  moved `ok`→`cut` in crop-qa), plausible from the geometry shift but **not
  re-verified image-by-image**.
- The `X_MIN = 0.50` x-gate in `dedupContained()` is an addition not in the plan;
  it is re-derived from the pipeline's own convention and fixes a demonstrated
  real bug, but deserves a second look.
- Stage 2's best-first tie-break weakness (Traps below) remains a distinct open
  mechanism, unrelated to Stage 3.
- The flaky `test:app` check (Traps below) remains unfixed.

## What landed this session — first real use of the product, a published FALSE fixed at the mechanism, sign/app/design fixes

**The project was used and read for the first time.** Four independent passes: the
app driven in a real browser (60+ cards, mock exam, both themes, 390px), 121 sign
images opened visually, chapter 6 read page-by-page against the scan photographs,
and 54 authored questions reviewed. **All 197+97 checks were green throughout, and
that did not mean the product was good** — every defect below was invisible to the
suites.

**A published FALSE, found by reading, fixed at the mechanism.** Book p.96 published
"Cars that have transmissions should only be towed…", dropping "automatic" and
widening a rule about automatics into a restriction on all towing. Card `ch-6-a-03`
was correctly worded from the fact (per the authoring contract) — only the edition
was wrong. Root cause: the towing callout box was mis-detected as a photo region,
and `pageBody()`'s `insidePicture()` guard drops lines that are both ≤14 chars and
inside a figure's core bounds; every other line of the callout was longer and
survived, so only the 9-character word "automatic" was swallowed. Vision had read it
at conf 1.0 all along — this was never an OCR defect. Fix in `pipeline/src/layout.ts`:
`rawInsidePicture` + a new `isSandwichedProse()` — measured, of the 548 lines
`insidePicture` drops corpus-wide, 34 have surviving same-column prose neighbours
above **and** below (Δx<0.03, Δy<0.03); 33 are unambiguous sentence completions and
the 34th is a licence-specimen fragment at conf 0.30, excluded by a `conf >= 0.4`
floor. **Not a regression from the OCR stages** — the defect reads identically in all
three archived stage baselines. Blast radius: paragraphs correctly merged on 7 other
pages, 5 citations re-pointed and repaired (`ch-1-2-a-07`, `ch-4-b-06`, `ch-4-c-08`,
`ch-5-b-08`, `ch-6-a-03`). Collateral: on `Ch. 5-p007b` restoring two rescued words
shifted that column's statistics and fragmented a nearby paragraph further —
pre-existing C5 `paragraphize` fragility, triggered, not introduced, nothing false.

**Five sign crops shipped wrong images for their labels** (found by opening them):
`10full:xa3ofy` (illegible photographic noise), `8full:5ucr98-2` (five black dots, no
person icon, shipped as "Caution - blind people"), `4full:v2px8m`/`bgtx5p-2` (lorry
turning-space pair with left/right labels **swapped**), `3full:1puizi3-2` (lane-group
heading on a direction arrow), `4full:bgtx5p` (catalogue only). All excluded, 10
cards lost. Diagnostic pattern worth recording: in 3 of 5, one sibling was already
excluded and an identical-defect sibling had been missed — **a mechanical exclusion
rule plus a `reason` field that only describes the image lets a good sign sit out,
or a bad one ship, unnoticed.** A sibling sweep of all 121 sign images plus 8
directional pairs (verified by pixel-diffing: true mirrors diff 4–17, cross-pairings
30+) found no further mismatches.

**Over-exclusion found in the other direction.** `"Give-Way line` had been excluded
as `GARBLED_LABEL` for a stray quote, with nothing else in the deck covering
give-way lines. Read at 6×, the page prints `"Give-Way" line` — quotes on both sides;
OCR dropped the closing one. **Recovered** as `Give-Way line` (+2 cards, 765→767).
Fidelity tradeoff recorded honestly: `CLEAN_LABEL`'s charset excludes `"`
project-wide (measured and rejected in an earlier session), so the shipped label is
not verbatim — diverging from the `Bus-stop` precedent, where the printed hyphen was
kept. Verbatim was unreachable here. Two stayed out with real justifications:
`Unbroken dividing ine` (confirmed as "dividing line", but visually indistinguishable
at card size from in-deck `p010full-s002` and a mutual distractor — retyped
`AMBIGUOUS_PAIR`); `Orgamized street running` (re-read at magnification — the book
really prints it, the source's own typo, so `GARBLED_LABEL` was the wrong exclusion
type; retyped `SOURCE_TYPO`, kept out because a non-word as the sole correct answer
among clean distractors reads as an app bug). Also: 10 exclusion `reason` fields
rewritten to justify rather than describe, 2 `GARBLED_LABEL`→`WRONG_LABEL`, 1
→`BAD_CROP`, 2 truncated reason strings repaired.

**A landmine defused.** `sign-label-corrections.json`'s RECOVERY note for
`p003full-s017` instructed a future maintainer to delete that sign's exclusion — the
exact sign re-excluded above. Now prefixed "SUPERSEDED 2026-08-06 — DO NOT ACT ON THE
RECOVERY BELOW" with the reasoning; original note preserved; this file and
`sign-exclusions.json` deliberately disagree, same convention as `p010full-s007`.

**App bugs fixed** (`app/js/`): (a) **the "one direction per sign per session"
promise was broken** — `viewSigns()`'s per-category buttons called
`Engine.shuffled(list).slice(0,20)` and bypassed `oneDirectionPerSign` entirely; only
the "Mixed signs" entry point honoured it, so both directions of a sign were
routinely served in one sitting. (b) **"Seen" tile over-reported** — now
`Engine.seenCount(cards, sched)` counts only ids in the live deck; nothing is deleted
from storage since a retired card can return. Two regression tests added (97→99),
each confirmed to fail against the pre-fix code. (c) A third reported bug —
distractors not drawn from a sign's own category — was **measured and refuted**:
99.48% of distractor slots are already same-category across 1,536 slots; the only
leakage is "Police hand signals" (2 signs, cannot fill 3 distractors). What was
actually observed was repetition *within* a category. Recorded as refuted so it is
not re-"fixed".

**Design pass.** Merriweather self-hosted (400/700/italic, ~304KB static files —
the variable family's name table reports every instance as "Light 18pt", so static
was the correct choice), paired with the existing system stack for chrome: read vs
operated. Measured contrast: dark 14.42:1 body, light 13.99:1, tightest pair 4.61:1
(above the 4.5:1 AA floor), accent 9.67:1. Added an Icelandic-hazard-sign due chip
and a lightbox for sign images (road-marking diagrams were illegible at card size).
Fonts wired through `pipeline/src/build-html.ts` → `pipeline/assets/fonts/` so they
survive a rebuild. Four briefed problems (sign-grid reflow, tabular numerals,
keyboard access, reduced-motion) were found **already solved** and verified rather
than fixed. One flex bug caught after: `.duechip`'s `gap` did not apply between two
adjacent bare text nodes, which collapse into a single anonymous flex item — the
glyph now has its own element.

**Still open, newly recorded this session:**
- `ch-7-a-21` cites a table-header fragment; the real text is in uncited
  `ch-7:6a:1v9m2dq`. Not fixed — `cards --strict` only fails when a cited chunk
  *vanishes*, so a card citing an existing-but-wrong chunk is invisible to it.
- `ch-6-b-05`'s explanation asserts a fact from an adjacent uncited chunk. Not fixed.
- Duplicate pair `ch-1-2-a-11` / `ch-5-a-17` (same trailer-towing rule). Not fixed.
- **Sheep and reindeer remain at zero cards; the record is corrected.** "Crosswind"
  is a **book** gap, not a deck gap — the word appears nowhere in the source. The
  sheep passage sits in `ch-4:17b:10uptcl`, already cited twice for other facts.
- Missing figures on ch-6 pp.98, 106, 111 — whole diagrams absent, captions surviving
  as orphaned text. p.106's reversed tread labels (see "Known imperfections") cannot
  assert anything backwards *because* the diagrams that would label them are absent.
- 43 `ok`-graded figures in `figures.json` have no file in `site/figures/`; unexplained.
- The 4 figures that vanished during the OCR stages were never identified — no
  pre-session `figures.json` was archived, and the only baseline predates a filename
  convention change.
- Local `file://` localStorage in the dev browser now contains agent-generated study
  history and mock-exam results.

Suites re-verified at the end of this session: `test:e2e` 197/197, `test:app`
99/99, `cards -- --strict` exit 0 (767 cards — 247 MCQ / 6 cloze / 514 sign / 27
exclusions), `typecheck` clean.

## Where to pick up

`FIXES.md` is the authority and is current. **The OCR-omission sweep (C6/C10/C11) is
now finished** — all three stages landed, and ch-6 p.101's inverted safety
instruction, the last item in the project that could teach something false, is
restored. That item no longer heads this list; it was ranked behind everything
below and is now closed, so the small items it displaced move up. **In the order
`FIXES.md` now recommends:**

1. **C4, C9, C7 — the small ones**, roughly an hour together. C4: wrong and
   unanswerable cards from sign sheet p005 and p010. C9: signs detected only by
   their caption. C7: text callout boxes published as pictures.
2. **B1-r1** — the crop colour-coverage gate does not separate cleanly everywhere. Two
   measured counter-examples are named in the entry (`p005full-s006`, `p008full-s062`);
   seven of B12's corrections exist only to strip an on-face legend, which is the symptom.
   Re-measuring the gate means re-running `npm run figures`.
3. **B8** — 15.9% of citations land mid-sentence. A merge pass over adjacent chunks in
   `dataset.ts` fixes the class rather than each case. Note the merges this session made
   this *slightly worse in one direction*: six chunks now each carry two or more citations.
4. **B10/B11 — authoring, and it is unbounded.** 62 targets. The concrete gap:
   **"sheep", "reindeer" and "crosswind" appear zero times** across all 247 authored
   questions. Motorway's zero coverage is fine — Iceland has none.
5. **The four C5 residuals.** `C5-r1` has a live candidate (`CROSS_MAX = 4`) that needs
   ch-5 p.86 and ch-6 p.101 eyeballed first. `C5-r4` is a one-line sort in `proseBlocks`
   whose blast radius is corpus-wide. **`C5-r2` and `C5-r3` are closed as measured and
   rejected — do not retry them**; see "measured and rejected" below.

**New, open items from the validation-pass session, not yet ranked into the list
above, all recorded in "What landed this session — first real use of the product"
above:** `ch-7-a-21` cites a table-header fragment instead of `ch-7:6a:1v9m2dq`;
`ch-6-b-05`'s explanation borrows a fact from an uncited neighbour; duplicate pair
`ch-1-2-a-11`/`ch-5-a-17`; missing figures on ch-6 pp.98, 106, 111; 43 orphaned
`figures.json` entries with no file in `site/figures/`. None teaches something
false — see the session section for why each is deferred rather than fixed.

**New, open items the OCR-omission sweep leaves behind — not yet ranked into the
list above, all recorded in "What landed this session — the OCR Stage 3 fix round"
above:**

- Figure and sign crop counts drifted (figures 381→377, signs 912→908, ~4 items
  moved `ok`→`cut`) — plausible from Stage 3's geometry shift, not re-verified
  image-by-image.
- The `X_MIN = 0.50` x-gate added to `dedupContained()` deserves a second look — it
  is re-derived from the pipeline's own convention, not from the plan, and fixes a
  demonstrated real text-deletion bug, but was added under time pressure to ship
  Stage 3 safely.
- Stage 2's best-first tie-break weakness (Traps #10 below) is a distinct,
  still-open mechanism, unrelated to Stage 3.
- The flaky `test:app` check (Traps #9 below) remains unfixed.

**Still true, unrelated to the OCR sweep, and larger than anything above:** the
publishable `public/` tree does not exist yet, and nothing in `test/` has ever been
committed or pushed — see "Publishing" below before touching git.

## Publishing — read this before you commit anything

The repo is a public GitHub Pages site. `test/.gitignore` is written and covers the PDFs,
`practice/`, `build/work/`, `build/qa/`, `node_modules/`, `.superpowers/` and `site/`.

- **No env files or secrets exist anywhere in the repo** — a sweep for `.env*`, `*.pem`,
  `*.key`, credentials and tokens came back empty, and `test/` has never been tracked, so
  nothing is in git history.
- **Excluding the PDFs does not stop the leak.** `site/scans/` is **188 full-page JPEG
  photographs of the book** (51 MB) — the "View original scan" toggle. Publishing `site/`
  republishes the entire textbook as images, the same content by another route.
  `site/figures/` adds 58 MB of cropped figures from the same pages. That is why `site/` is
  ignored wholesale.
- **The publishable tree does not exist yet.** The intended shape is a pruned `public/`
  containing only what a static site needs: chapter HTML **with the scan toggle stripped**,
  `assets/`, `figures/`, and the app (`data/`, `signs/` at 14 MB, `css/`, `js/`) — no
  scans, no `qa.html`, no `build/qa` screenshots. It must be a separate tree, not a
  modified `site/`, because both suites run against `site/` and expect the scans to be
  there. Nothing is committed and nothing is pushed.
- The app links to the reading edition at `../site/` (`app/js/ui.js`), so whatever
  directory layout `public/` uses has to preserve that relative relationship or the
  "See it in the book" links break.

## Measured and rejected — do not redo these

Every one of these was tried, measured, and turned down. The measurements are in
`FIXES.md` and the ledger.

- **`C5-r2`'s heading fix.** The candidate (`gap > bodyH * 1.4`, chosen off a real valley
  in 30 grouped heading pairs) took sections 91 → **93**, not 92: it recovered the target
  heading, re-created a spurious `711/ Vatnsnes` heading, and demoted the appendix's own
  title `Traffic signs.` on a page the stage never touched. One recovered, one invented,
  one demoted.
- **`C5-r3`'s four discriminators.** Crop containment looked like a 6× separation and is an
  **artefact of sign-detector coverage, not physics** — the winning case escapes only
  because that sign was never cropped, so the rule would flip whenever `npm run figures`
  re-runs. Line-height ratio, OCR confidence, and a geometric continuation-line proxy also
  fail; the last vetoes one of the plan's own defining cases. The real discriminator is
  whether the partner line *opens* or *continues* a paragraph, which is not knowable where
  the ordering happens.
- **The OCR plan's `≥ 900` population floor.** Not reachable by any defensible parameter
  setting; the plan's own stated parameters produce 1,259. Shipped floor is 1,050. The
  three published numbers (1,336 / 1,045 / 1,259) are three estimators, not three corpora.
- **B7's group-wise `shared` filter** would drop 28 signs currently in the deck.
- **Auto-correcting OCR text.** 166 proposed single-edit fixes led with
  `braking → broking`, `called → celled`, `parties → panties`.
- **"Distractors aren't drawn from a sign's own category."** Measured across 1,536
  distractor slots: 99.48% are already same-category; the only leakage is "Police
  hand signals" (2 signs, cannot fill 3 distractors on its own). The reported
  symptom was repetition *within* a category, not cross-category leakage. Refuted —
  do not re-fix.
- **OCR-omission Stage 1's ungated variant.** An ungated prefix-superset rule in
  `better()`, and a bare tail-length threshold with no alnum gate, were both measured
  against the corpus and rejected in favour of the shipped `hasAlnum`-gated rule.

## Traps — the new ones matter most

Everything in the previous handover still applies (no text layer, content overflows the
`mediaBox`, one PDF page is a two-page spread, `/Rotate` lies, Vision hides upside-down
pages and clips first glyphs, the widest central gap is not the gutter, bold headings crop
as graphics, `app/js` shares one global scope so grep before adding a top-level binding,
`test:app` exceeds a 120-second tool timeout, never run `npm run ocr` casually). Added this
session:

1. **`npm run dataset` and `npm run cards` both silently rebuild `site/`**, because
   `build-html.ts` calls `main()` unguarded at module scope and `dataset.ts` imports it for
   `isRule`. It matters for stage sequencing and for any byte-identity comparison.
2. **Correcting a sign label cannot move a sign id, and `--update-ids` is the wrong tool
   for one.** The hash is taken from the OCR caption in `dataset.ts`, strictly upstream of
   where corrections load in `cards.ts`. Measured across B12's 27 corrections: **0 of 357
   ids moved**. The trap is the inverse — moving the hash to the corrected label would
   orphan all 27 at once. A consequence: **`sign-id-baseline.json` records OCR strings, not
   what the deck teaches** (`6full:1u74i2b → "FO CE"` is the card that ships as `Police`).
   Correct for its job; wrong to read as a label inventory.
3. **Line-number citations in comments go stale within the hour.** Four did this session.
   Cite the function name.
4. **A guard whose denominator can shrink is not a floor.** `purity.testable >= 1300` was
   calibrated against a pre-fix denominator of 1,405; merging fragments took it to 1,276,
   so no correct implementation could pass. It was replaced with `purity.pages >= 120`
   (measured 149), which is invariant to chunk merging. This was a **recalibration of a
   same-day anti-vacuity guard, not the lowering of a measured floor** — the distinction
   matters, and the 189 pre-existing floors were never touched.
5. **A check whose oracle is its own subject cannot see a wrong answer.** The frame-purity
   check was written while `frameCut` was uncalled; once `frameCut` shipped, the check can
   only detect a regression in downstream reassembly, not a wrong frame partition. Its
   comment now says so. This is why the OCR detector deliberately does **not** reuse
   `frameCut` for its column model — do not "simplify" that away.
6. **Frame purity's numerator is mostly noise.** Of the 12 contaminated chunks, **10 are
   substring false positives** (a short aside line whose text also occurs verbatim in the
   body prose) and only 2 are real, both `C5-r1`. Three-word lines coincide freely. The
   floor still moves in the right direction under a real regression; it just does not mean
   what its name suggests.
7. **Cloze ids are positional** (`cloze:<chunk>:<n>`), so the three new ch-4 p.66 cloze
   cards renumbered the two pre-existing ones from `:0`/`:1` to `:3`/`:4`. With the two
   deleted MCQs that is four retired ids, and `app/js/ui.js` counts
   `Object.keys(st.sched).length` for the "Seen" tile, so a returning student's count
   over-reports by up to 4. **Content-derived cloze ids must land before any
   `km/h ↔ km/hour` normalisation**, or the renumbering happens twice.
8. **`cards.ts --strict` fails closed — it exits before writing `app/data/`.** So the OCR
   plan's predicted mid-repair state (247 written / 238 shipped, 2 failing app checks) is
   not reachable through the npm script; a violation blocks the write entirely rather than
   shipping a partial deck. The real hazard is the inverse: **a stale `app/data/` left over
   from before a rebuild makes `test:app` look green** even though it is testing yesterday's
   deck. Confirm `app/data/` was actually regenerated before trusting a green `test:app`
   after any pipeline change.
9. **`test:app` has a flaky check.** `desktop: the correct option is marked` failed once
   and passed on immediate rerun — random question selection timing. A flaky check in this
   suite is a defect in its own right and needs its own fix; do not dismiss a red run as
   flake without rerunning and reading which check actually failed.
10. **Green suites do not mean a good product.** All 197 e2e + 97 app checks stayed
    green through a session that found a published FALSE, five wrong sign images, an
    over-exclusion, and two app bugs — none of it visible to any assertion in place.
    Suites prove regressions didn't happen; they do not prove the thing is right.
    Reading and driving the product is a distinct, still-necessary step.
11. **A mechanical exclusion rule plus a `reason` field that only describes the
    image, rather than justifying the exclusion, lets a good sign sit out for a
    stray glyph unnoticed — and its inverse lets a bad sign ship unnoticed.** In 3 of
    5 wrong-image signs found this session, an identical-defect sibling on the same
    sheet had already been excluded and the twin was missed; a sibling sweep is
    required whenever one sign on a row is found bad.
12. **A stale "delete this exclusion" note in a corrections file can point straight
    at a sign that gets legitimately re-excluded later.** `sign-label-corrections.json`
    told a future maintainer to restore `p003full-s017`; it was re-excluded this
    session for a real defect. Superseded notes must be struck through with the
    reason left in place, not deleted — the two files are allowed to disagree, on
    record, same as `p010full-s007`.
13. **Stage 2's best-first tie-break is a second, distinct, still-open mechanism.** On a
    handful of pages a geometrically-higher-scoring but lower-confidence/garbled candidate
    wins a 1:1 slot, leaving a stray duplicate or dropping a garbled fragment
    (`Ch. 6-p010b`, `Ch. 7-p002b`). Not introduced by the fusion extension above, not part
    of the one-to-many defect it fixes, and deserves its own measured fix — do not fold it
    into either.

## Known imperfections, deliberately left

- **Two authored questions were deleted**, and their ids must **never be reused** (a new
  `appendix-a-09` would inherit the retired card's SM-2 history —
  `pipeline/cards/README.md` now says so):
  - `appendix-a-09` — the single-lane paved-surface sign applies at ≤ 5 m width.
  - `appendix-a-10` — a supplementary speed plate is the *recommended*, not the legal,
    maximum.
  Both facts now survive only as figure captions; no chunk anywhere carries them, verified
  corpus-wide, so re-pointing would have attached a true question to a chunk that does not
  support it.
- **The cloze deck is 5, and one duplicates `ch-4-c-07`** — `cloze.ts` compares the
  authored `60 km/h` against the book's `60 km/hour`, so suppression misses. Both cards are
  true: redundancy, not falsehood.
- **`ch-8-b-11` cites a 69-character fragment** on the book's highest-stakes page, with the
  instruction's object in the adjacent unchanged chunk. No worse than the chunk it
  replaced, which ended at the same word.
- **ch-6 p.97**: legend items 1–18 now number correctly, but a `17 18` numeral pair heads
  the Brake-system-alert description and a stray `16` sits inside `Anti-lock brake system
  16 indicator.` Printed on the page, previously in a junk figcaption, cited by no card.
- **ch-6 p.106**'s `Worn Tread` / `New Tread` and `Unstudded` / `Studded` labels are
  emitted in reversed page order. The safety-relevant win is real and confirmed: the false
  merge `Studded Unstudded winter tire`, which fused two mutually exclusive categories, is
  dissolved.
- **Red Cross step 4 on ch-8 p.141** is still prose — Vision read its enumerator as `A.`.
- **`004-017`'s sign label is not corrected.** Every word is present but whether it is one
  sentence or two cannot be read off the page. This is the line the project does not cross.
- Four more B12 refusals stand, each for a stated reason: `008-064` (`Orgamized` — at 8–12×
  the page really does print `Orgamized`), `010-010` (a visual twin of in-deck `010-002`),
  `005-012` (clipped crop; its clean twin `005-031` was recovered instead), and
  `010-004`/`010-007` above.
- `practice/` remains **out of scope** — its answer sheets are graphical and need geometric
  extraction, not OCR. Do not silently revisit this.
- The emergency number rendered `1 -2 – 2` on ch-8 p.141 is **the book's own typo**,
  faithfully reproduced.
- **`Unbroken dividing ine`** — the caption confirms "dividing line", but the crop is
  visually indistinguishable at card size from in-deck `p010full-s002`, and the two
  are mutual distractors. Kept out, retyped `AMBIGUOUS_PAIR` (was `GARBLED_LABEL`).
- **`Orgamized street running`** — re-read at magnification, the page really prints
  it; the source's own typo, not an OCR defect, retyped `SOURCE_TYPO`. Kept out
  because a non-word as the sole correct answer among clean distractors reads as an
  app bug, and the app has no "as printed" affordance.
- **`"Give-Way line`** is shipped without its opening quote (`CLEAN_LABEL`'s charset
  excludes `"` project-wide) — the one sign in the deck whose label is not verbatim
  the page, unlike the `Bus-stop` precedent which kept its printed hyphen. Verbatim
  was unreachable here; recorded rather than silently accepted.

## Where the evidence lives

`build/qa/plan-ocr-omission.md` — the plan for all three OCR-omission stages; Stage 1 is
now executed against it, Stages 2 and 3 are next. `build/qa/ocr-stage-0-report.md` —
what Stage 0 measured. `build/qa/validation-2026-08-05/` — the audits
(`mobile.md`, `scans.md`, `questions.md`, `persistence.md`, `sign-caption-leak.md`,
`sign-labels.md` with its 357-row table, `dropped-words.md`), the fix reports, and
`plan-column-interleaving.md`, which was executed almost verbatim this session.

`.superpowers/sdd/plan-column-interleaving/` — this session's ledger (`progress.md`), the
per-stage briefs and reports, and the review packages. Git-ignored scratch; the ledger is
the only part worth keeping.

`pipeline/cards/*.json`, `sign-exclusions.json` and `sign-label-corrections.json` are
**hand-made data** — losing them loses real work. `build/work/`, `site/`, `app/data/` and
`app/signs/` are derived and safe to delete and rebuild.
