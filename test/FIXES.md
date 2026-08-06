# Fix sweep — worklist from the 2026-08-05 validation pass

One place to collect everything the validation found, so it can be fixed in a
single sweep rather than five. Evidence lives in
`build/qa/validation-2026-08-05/`.

**Status of the audit itself**

| Track | Report | State |
| --- | --- | --- |
| Phone / mobile layout | `mobile.md` | complete |
| Scanned-page selective validation | `scans.md` | complete |
| Question structure + book coverage | `questions.md` | complete |
| localStorage durability | `persistence.md` | complete |
| Sign caption leak, measured | `sign-caption-leak.md` | complete |
| Sign labels, all 357 validated | `sign-labels.md` | complete |
| Silent OCR omission probe | `dropped-words.md` | complete |
| Visual redesign + mobile fixes | `design.md` | **done — A1–A5 fixed and verified** |
| Persistence hardening | `fixed-persistence.md` | **done — A6–A11, A13, A7 fixed and verified** |
| Layout text defects (C1–C3, C8) | `fixed-layout-text.md` | **done — fixed and verified** |
| Sign crops + card-id stability (B1, A12) | `fixed-sign-crops.md` | **done — fixed and verified** |
| Question corpus (B2–B7, B9) | see "Question corpus" below | **done — fixed and verified** |

Baseline before any change: `test:e2e` 180 green · `test:app` 94 green ·
`tsc --noEmit` clean. **Current state, all re-verified independently: `test:e2e`
189 green · `test:app` 97 green · typecheck clean. 12 new checks added across the
two suites, no floor lowered.** Deck: **755 cards — 249 authored MCQ, 2 cloze,
504 sign across 252 signs.**

**Also fixed in this pass — the question corpus: B2, B3, B4, B5, B6, B7 (part), B9.**
`pipeline/src/cards.ts`, `cloze.ts`, `e2e-app.ts`, `pipeline/cards/*.json`,
`package.json`, and a new `pipeline/cards/sign-label-corrections.json`.

- **B3** — all 11 declared rules now reject; `--strict` is wired into `npm run cards`.
  Proven by planting a violation of each of the 7 previously-advisory rules in turn
  and confirming exit 1, then restoring the file byte-identical.
- **B4** — the checks now read the authored packets, not the reshuffled output, and
  the source key was rebalanced: **chi-square 185.05 → 0.60**, worst slot 62% → 26%,
  every packet ≤ 29%. Six packets that were 19–20 answers all at index 0 are spread.
  The rebalance is semantics-preserving by construction — same four options, same one
  correct — asserted per question, and uses a **hash-ordered** round-robin so it does
  not swap "always A" for "A, B, C, D, A".
- **B5** — the denominator is now the judgeable items (four distinct option lengths)
  instead of all 252, so the floor tests something real for the first time.
- **B6** — cloze 7 → 2 by rule, not by hand: sentence-shape tests drop the
  penalty-table fragment and the collapsed-grammar card, and same-passage duplicate
  suppression drops **4** cards re-testing a number an authored MCQ already covered.
- **B9** — 3 appendix questions that re-tested ch-3 facts removed, plus a
  near-identical-question floor at jaccard 0.7.
- **B2, B7** — see their entries; both changed shape once the evidence was in.

**Three thresholds I got wrong first, each caught by its own check.** Recorded because
the lesson is the same every time: the guess was plausible and the data disagreed.
1. The cloze duplicate rule matched digits only, and **missed** `3 months` against the
   authored "Three months" — authors spell small numbers out, the book prints numerals.
2. Adding bare number-words then **over-corrected**, suppressing `3 years` (the span
   in which 12 points accumulate) because "Three months" — a different fact from the
   same passage — also contains "three". Comparing the number *with its unit* fixes
   both.
3. The edit-distance-1 sign-label floor flagged `Blind rise`/`Blind rises` and
   `Direction arrow`/`Direction arrows`. Reading the crops showed all four are real,
   distinct signs — the faces print **BLINDHÆÐ** and **BLINDHÆÐIR**. A trailing "s" is
   now exempt; an OCR duplicate differs *inside* a word.

None of these would have been caught by reading the code, and two of them would have
silently deleted good cards.

**Also fixed in this pass — C1, C2, C3, C8.** `pipeline/src/layout.ts`,
`build-html.ts`, `e2e.ts`. Verified against the rendered pages, not on report: the
p.97 dashboard legend numbers **1–18 continuously** across 7 and 5 fragments (clock →
battery warning, checked item by item); ch-8 p.141's Red Cross procedure reads
**1, 2, 3**; and the contents folios are **Hazard signs 21, Prohibitive 22, Road
surface markings 28**.

Two caveats recorded honestly by the agent and confirmed by me:
- **Red Cross step 4 is still in prose**, because Vision read its enumerator as
  `A.`. The procedure is no longer *mis*numbered, but it is not fully recovered.
- The p.97 legend items 6, 9 and 10 still carry stray interleaved fragments
  ("medium and aiding tools to help", "5", "2") — that is C5, untouched by design.

Worth keeping: an earlier attempt gated `start` behind "only if it continues a run
here", and that **silently re-broke two first-aid steps**. `start` is now taken
verbatim. The new checks quantify the old damage: ordered-list enumerators **81
matched / 0 wrong, against 44 of 85 wrong before**; TOC folios **95.1% against 22%**.

**Citation impact, for wave 2: exactly one card re-points.** Of 16 citations landing
on changed sections, only `ch-4-c-19`: `ch-4:19a:vmf8ox` → `ch-4:19a:1t6ltnc`, still
carrying the 15-metre bus-stop rule. `build/work/dataset.json` **on disk is stale** —
diff from a fresh build, not from the file.

**Already fixed in this pass — A1 to A5.** `app/css/style.css` (rewritten) and
`app/js/ui.js`. Independently re-verified at 375×667 in real Chrome: verdict and a
full-width sticky Next both visible without scrolling, sticky run bar keeping the
countdown on screen, scroll reset on advance, sign images 198×176 (was 80×80) in a
2-column tile grid with 0 px overflow, warm dark and warm-paper light themes with a
serif reading face, and `✓ CORRECT ANSWER` / `✕ YOUR ANSWER` labels so the graded
state is not colour-alone. One regression found and fixed during verification: the
header's `backdrop-filter: saturate(140%)` smeared the coloured sign crops into a
rainbow behind the title — now blur-only at 96% opacity.

**Also fixed in this pass — A6 to A11, A13, A7.** `app/js/store.js` (rewritten),
`app/js/ui.js`, `app/index.html`. Independently re-verified in a real browser, not
taken on report: two tabs **8 → 8** on closing the untouched one (was 8 → 0); exam
answers held out of `log` until submission, **0** mid-paper (was 12, poisoning
accuracy); a mid-exam reload resumes with *"Mock exam — 25 of 30 questions left,
39:59"*; `{"log":7}`, `{"sched":null}`, `{"log":[null]}` and invalid JSON all boot to
a usable app with **zero console errors** (four of these were previously fatal blank
screens); and a rejected payload is preserved at `iceland-theory:v1.rejected`.

A6 was decided as **persist and resume**: `deadline` is absolute wall-clock, so a
reload costs exam time rather than pausing it, which makes resuming faithful rather
than a loophole. Withholding exam answers from `log` until submission kills the
log/sched divergence at its root, which is why `engine.js` needed no exclusion logic.

**One bug this introduced and how it was caught, because the pattern will recur.**
The rewrite added `const fresh` at top level in `store.js`, colliding with the global
`function fresh()` already in `sm2.js:15`. **None of the app's JS is wrapped in an
IIFE** — they are classic scripts sharing one global scope, loaded sm2 → store →
engine → ui — so a `const` shadowing an existing global function declaration is a
SyntaxError. `store.js` never parsed, `window.Store` was undefined, and the app did
not boot at all. `tsc --noEmit` stayed **clean** throughout; only `test:app` caught
it. Renamed to `blankState`. Before adding any top-level binding in `app/js`, grep
the other three files for the name.

## How to read this list

Each item carries an id, a severity, the evidence it rests on, the files it
touches, and the check that says it is done. Severity is about the **student**,
not the code:

- **S1** — could teach something false, or destroys study history.
- **S2** — degrades every session, or hides information the student needs now.
- **S3** — real but survivable friction.
- **S4** — polish.
- **✅ DONE** — fixed and independently re-verified in this pass. The description is
  kept as written so the next person can see what the symptom was.

Two project rules bind every item below. Thresholds are **measured, not
guessed** — re-measure and look at a contact sheet before changing a cutoff in
`layout.ts` or `cards.ts`. And **a missing card beats a wrong card** — when a fix
is uncertain, drop the card and record the gap.

---

## A. Study-app behaviour and layout

Confirmed by driving real Chrome at 390×844 and 375×667 with touch and mobile
flags set. Full detail and screenshots: `mobile.md`, `mobile/`.

### A1 · ✅ DONE · Answer feedback lands below the fold
On a sign card at 375×667 the verdict panel starts at **y ≈ 714 in a 667 px
viewport** — the student taps an option and sees no "Correct"/"Wrong", no
explanation, no Next. Only the chosen option's green border changes, and it is
itself clipped at the bottom edge. At 390×844 the Next button still sits 32 px
below the fold (`nextBottom` 876 vs viewport 844), so each of the 486 sign cards
costs a scroll. The app never scrolls the feedback into view.
*Files:* `app/js/ui.js`, `app/css/style.css`.
*Done when:* at 375×667, the verdict is visible without scrolling immediately
after answering, on both a text card and a sign card.

### A2 · ✅ DONE · Scroll position is not reset between cards
Next keeps the previous offset. Measured at 375×667 after advancing: `scrollY`
158, card top **−90 px**, so the stem's first line and the "Signs · 2 of 20"
header are off-screen — one screenshot shows a question rendering as just
`first to right"?`. Affects every card after the first, in every mode.
*Files:* `app/js/ui.js`.
*Done when:* advancing lands with the new card's tag row and stem fully visible.

### A3 · ✅ DONE · The exam countdown scrolls away
`.runbar` is `position: static`. On an image question during the timed mock exam
at 375×667, scrolling to reach options C and D puts the run bar at **top
−109 px, not visible** — clock and question counter both gone. Losing the timer
during a timed exam is functional, not cosmetic.
*Files:* `app/css/style.css`.
*Done when:* the clock stays visible at any scroll offset during a mock exam,
without covering card content.

### A4 · ✅ DONE · Sign option images are too small to study from
Sign images render at **80 × 80 CSS px** from 900 px sources inside a 324 px-wide
button — roughly 230 px of each row is dead space. Adequate for a bend warning,
poor for service pictograms, supplementary plates, and route/direction signs
carrying place names and numbers. The exam tests recognition at a glance.
*Files:* `app/css/style.css`, possibly `app/js/ui.js` for a 2×2 tile grid.
*Done when:* signs are legibly large on a 375 px-wide screen and the existing
"picture options never overflow the phone width" check still passes.

### A5 · ✅ DONE · Visual design: off pure black, real reading typography
Requested directly. Dark theme is near-#000 with a UI font throughout. Wanted: a
soft warm dark with layered surfaces, a warm-paper light theme, a reading face
for stems and explanations, tabular figures for the clock and stats, a
comfortable measure and type scale. Constraints that cannot bend — no build step,
no network requests of any kind (so system faces or vendored woff2 only), dark
stays the default, AA contrast in both themes, `test:app` stays green.
*Files:* `app/css/style.css`, `app/index.html`, `app/js/ui.js`.

### A6 · ✅ DONE · Mid-exam loss is worse than `HANDOVER.md` recorded
Reload, "Abandon exam" and a back-tap all leave `log=12, exams=0, sched=0` after a
12-answer paper. So the answers are kept where they do harm — dragging accuracy to
**0%** and skewing practice weighting — and **never reach SM-2 at all**, so `Seen`
stays 0 and every one of those cards counts as new again later. The student loses
the paper, the dashboard lies, and the scheduler learns nothing. Abandoning still
does not ask first.
*Files:* `app/js/store.js`, `app/js/engine.js`, `app/js/ui.js` (`Store.setSession`
persistence).
*Done when:* a reload mid-exam resumes the paper with its remaining time, or the
paper is discarded cleanly with its answers excluded from accuracy — and
abandoning asks first.

### A7 · ✅ DONE · "See it in the book" links assume a sibling `site/`
Carried over from `HANDOVER.md`. Links point at `../site/`, so they break the
moment `app/` is copied somewhere on its own — which `file://` support invites.
Verified present: a card's link resolved to
`file:///…/test/site/ch-8.html#p-2b`.
*Files:* `pipeline/src/cards.ts` or `app/js/ui.js`.

### A8 · ✅ DONE · A second tab silently destroys the first tab's history
`flush()` blind-overwrites storage from a snapshot taken at load time. There is no
merge, no `storage` event listener (the event fires and is ignored), and
`pagehide → flush` re-stamps the stale state on the way out. Reproduced: open the
app, open it a second time, practise 8 cards, then close the *untouched* first tab
— storage goes **8 → 0**. Interleaved use across two tabs: 10 answers given, 5
stored. On a phone this is the ordinary "I left it open in another tab" case.
*Files:* `app/js/store.js` (`flush`, plus a `storage` listener).
*Done when:* two tabs answering in turn end with every answer present.

### A9 · ✅ DONE · `importJson` destroys progress before it validates
It checks only `'sched' in parsed`, then assigns and flushes. `{"sched":{}}` wiped
a real history. `{"sched":{},"log":5}` was accepted, persisted, and the app then
**failed to boot at all** — a permanent blank screen produced by a file the app
itself said it could not read. Import is the one feature a student reaches for
*because* something already went wrong.
*Files:* `app/js/store.js` (`importJson`).
*Done when:* a malformed import is rejected without touching stored state, and a
valid import is backed up before being applied.

### A10 · ✅ DONE · Wrong-shaped stored data is a fatal blank screen
7 of 27 corruption fixtures kill the app: `log` as a number, null, string or
object; `sched: null`; `exams: null`; `log:[null]`. `load()` spreads the parsed
object over the defaults, so a wrong-typed field overrides its default and every
later `.filter`/`.length` throws. Unparseable JSON is handled fine; the wrong
*shape* is not. There is **no `version` field** in the payload at all, so there is
also no migration path. Unknown future fields do round-trip safely.
*Files:* `app/js/store.js` (`load` → add `sanitize()`, `version`, `migrate()`).
*Done when:* all 27 fixtures boot to a usable app.

### A11 · ✅ DONE · Corruption evidence is erased at boot, and restores get clobbered
On hitting bad data the app flushes EMPTY within milliseconds and keeps no backup
key, so the broken payload — the only evidence of what happened — is gone before
anyone can look at it. The same path defeats manual recovery: 500 answers written
into the key read back as **0** after a reload.
*Files:* `app/js/store.js`.
*Done when:* a rejected payload is preserved under a backup key and never
overwritten by the boot flush.

### A12 · ✅ DONE · 486 of 745 card ids are unstable, so history misattributes
Sign ids hash the **positional crop filename** (`…-p001full-s003.png`) at
`pipeline/src/dataset.ts:250`, and MCQ ids are author-numbered. So the guarantee
`HANDOVER.md` records for chunk ids — content-derived, not positional — does not
hold for the 486 sign cards or the authored ids. Renumbering does not merely
orphan history, it **misattributes** it: injected orphans produced `Seen 900 /
Total 745` alongside "745 cards still to learn".
*Files:* `pipeline/src/dataset.ts` (hash the sign label, not the crop filename),
plus an id-baseline check at build time.
*Done when:* re-running the pipeline over unchanged sources yields byte-identical
card ids, and a deliberate crop renumber does not move any id.

### A13 · ✅ DONE · Storage failure is completely invisible
`QuotaExceededError` and a Safari-private-mode-style throwing `localStorage` both
boot and run normally, warning only to the console. The student studies a full
session and loses all of it at reload with no signal at any point.
*Files:* `app/js/store.js`, `app/js/ui.js` (a save-failure banner).
*Done when:* a throwing `localStorage` surfaces a visible, persistent warning.

### Persistence: what is already sound — do not "fix" these
- Writes are synchronous and un-debounced: two full-document writes per answer,
  never deferred to unload. A reload restored six answers, six SM-2 records with
  float ease `2.1799999999999997` intact, settings, the accuracy tile and every
  dashboard bar **byte-identically**. `file://` progress survived a full browser
  restart.
- **Quota is a non-issue**: 168.6 B per answer, 745 cards × 5 reviews ≈ 728 KB,
  and ~29 700 answers to reach 5 MB, at 1.85 ms per write. Do not add compression.
- Chromium shares one `file://` localStorage across all local documents, verified
  from a copy in an unrelated directory. Convenient here; worth knowing before
  anyone "fixes" it.
- When writing corruption fixtures, inject with `addInitScript` — the `pagehide`
  flush invalidates fixtures written any later.

---

## B. Question corpus

### B1 · ✅ DONE · Sign crops leak their own caption — 32 crops, 105 cards
A mock-exam question asked *"Which sign means 'Waste tank discharge'?"* and the
correct option, `signs/umferdarmerki-enska-p006full-s017.jpg`, is a crop that
**includes the printed caption "Waste tank / discharge" from the sheet**, baked
into the image — confirmed by opening the JPG. The card answers itself; the
sign→meaning direction is equally trivial. The three distractors in that question
showed clipped caption fragments too. The student is rewarded for reading labels
instead of recognising signs.

**Measured.** 32 of the 243 crops in the deck (13%) contain the sheet's printed
caption; **105 of 486 sign cards (22%) show one**, and on 64 the leak sits on the
*correct* option — 42 of those state the answer in full. As suspected, 29 of the 32
are Service signs: 42% of that section's crops, 92 of its 138 cards.

Severity, deliberately downgraded from S1: nothing here teaches anything false. The
harm is that SM-2 promotes these cards as "known" when the student only read a
label. Full giveaway 21 crops / 42 cards; partial but still decisive 11 crops / 22
cards (each fragment was checked against its card's four option strings and matches
exactly one); 41 distractor-only elimination hints.

**Fix: both, and in this order.** The permanent fix is a clip in `signs.swift` after
`trimToCore` (`:194`), using the text boxes it already loads — clamp a component's
bottom to a text line's top when that line's colour coverage is ≤ 0.50. Measured
support: the caption occupies the bottom 12.2–22.8% of crop height (median 16.0%),
and the graphic never continues below it.

Exclusion alone is **not** free and should not be the whole answer: it would cut
Service from 69 signs to 40 (−42%), the deck from 486 cards to 422, and permanently
discard 29 intact, correctly-labelled pictograms over 16% of crop height. Exclude
the 32 now to stop the bleeding, then clip and restore them.

*Files:* `build/tools/signs.swift` (recompile: `swiftc -O signs.swift -o signs`),
`pipeline/cards/sign-exclusions.json`.
*Caution:* text **on the sign face itself** is part of the graphic, not a defect —
the coverage gate is what separates them, and it separates cleanly: legends printed
on a sign face score 0.798–0.950 (SNÚNINGSRÝMI, Mosfellsbær, Borgarnes, 5,2 km),
printed page captions 0.217–0.469. The classifier was verified on 36 crops read as
images — 15/15 flagged crops genuinely show caption text, and it independently
re-finds the two crops a human reviewer had already excluded for this exact reason
(`p005full-s028`, `p007full-s011`).
*Trap:* the tempting one-liner in `signs.swift` — adding `&& !isText` to the
coloured term — is a trap the code already documents. Do not take it.

#### B1-r1 · residual after B1 · S2 · the colour-coverage gate does **not** separate cleanly everywhere — two counter-examples
**For the crop-gate owner, not for B12.** B1's caution above records the gate as
separating cleanly (sign-face legends 0.798–0.950, page captions 0.217–0.469). B12's
re-measurement found two crops where an **on-face legend has started landing inside
the label**, and both were verdict `correct` in the 2026-08-05 audit, i.e. they are
post-B1 regressions of the same shape, not survivors:

| crop | shipped label before B12 | printed caption | the on-face legend that leaked |
| --- | --- | --- | --- |
| `figures/umferdarmerki-enska-p005full-s006.jpg` | `2 km Notice of destination ahead` | `Notice of destination ahead` | `Möðruvellir` / `2 km`, in red inside the sign's red frame |
| `figures/umferdarmerki-enska-p008full-s062.jpg` | `EINDREID BRÙ Single-width bridge` | `Single-width bridge` | `EINBREIÐ BRÚ` along the bottom edge of the yellow face |

B12 has applied **label corrections** for both, which papers over the symptom and
leaves the class unfixed: the two labels are right now, but the gate that let the
legend in is unchanged. Counted exactly, from the 17 wrong in-deck labels B12
re-measured: **six in-deck labels were wrong for this one reason** — the four the
audit already knew (`RYMI` ×2 on `p004full-s022`/`s023`, `Mosfellsbær` on
`p004full-s035`, `5,2 km` on `p004full-s046`) plus the two counter-examples above.
A seventh instance sits out of deck on a recovered sign, `p005full-s031`, where the
face's own `107 Borgarnes` destination row had been taken into the label — so
**seven `sign-label-corrections.json` entries exist purely to strip an on-face
legend**, and every one of them is a symptom of this gate.

Deliberately **not** done in B12: re-tuning the gate means re-running `npm run
figures` and re-grading every crop, which is a separate change with its own blast
radius and must not ride along with a label-correction pass. Measure the gate against
these two crops specifically — they are the counter-examples that a re-tuned coverage
cutoff has to catch, and a cutoff that still passes them has not been re-measured.
*Files:* `build/tools/signs.swift` (recompile: `swiftc -O signs.swift -o signs`),
then `npm run figures` and re-grade.
*Check:* after re-tuning, the two crops above no longer carry their on-face legend in
the captured label, and the seven `sign-label-corrections.json` entries whose only job
is stripping an on-face legend become no-ops rather than load-bearing.

### B2 · ✅ DONE · A sign pair with two correct answers — and the fix is *not* an exclusion
Diagnosed precisely by `sign-labels.md`, and my earlier prescription here was wrong.
The sheet prints **the same caption**, "Traffic signals with direction arrows", over
two different dashed groups (`009-016` and `009-019`). OCR read the second as
`Traftic`, **and that single glyph is the only reason both entered the deck** — the
exact-label de-dup would otherwise have dropped one. On `sign-to-meaning:009-019`
both spellings are offered and the correctly-spelled one is graded wrong.

So: **correct the glyph and the de-dup removes the duplicate by itself.** No
`sign-exclusions.json` entry is needed, and adding one would lose a good sign.
*Files:* the label source — see B12 for how the 16 label corrections should be
applied.

### B3 · ✅ DONE · `cards.ts` enforces 4 of its 11 declared rules
`bad()` only appends to `errors` — the card still ships unless the check also
`continue`s. Declared and **unenforced**: duplicate ids, indistinct options, "all
of the above", short explanations, unknown topics, wrong-document citations. And
`npm run cards` never passes `--strict`.

Current violations: **0 of 252** — the corpus is clean, the guard rail is not. So
this is cheap to fix now and gets more expensive the moment someone authors
against a validator they believe is checking.
*Files:* `pipeline/src/cards.ts`, `package.json` (add `--strict`).
*Done when:* each declared rule rejects a deliberately planted violation.

### B4 · ✅ DONE · Three CI answer-key checks can never fail
The authored answer key is bunched hard — **χ² = 185.05, p ≈ 1e-39**, 156 of 252
keys at index 0, six packets at or near 100% (`ch-6-b` is 20/0/0/0). The shipped
deck is fine (χ² = 2.13) only because `cards.ts` reshuffles. But all three
answer-key checks at `e2e-app.ts:204–220` run on the **post-shuffle** output, so
they measure the shuffler, not the corpus, and cannot fail by construction.

Fix the checks to read the authored packets. The bunching itself is then worth
correcting at source: the shuffle is a real mitigation, but it means no one ever
sees the authoring habit.
*Files:* `pipeline/src/e2e-app.ts`, then `pipeline/cards/*.json`.

### B5 · ✅ DONE · Length asymmetry is exploitable, and its CI check is arithmetically broken
"Pick the first longest option" scores **35.7% against a 25% baseline** on the
shipped deck. The correct option is uniquely shortest only 14.7% of the time
(z = −3.78); mean length rank 2.02 against 2.50 expected.

The guard is broken: the check restricts its numerator to the 123 items with four
distinct option lengths but divides by all 252, reporting 20% against a 45% floor.
The true rate among evaluable items is **41.5%** — still under the floor, but the
floor was never actually being tested.
*Files:* `pipeline/src/e2e-app.ts` (fix the denominator), then pad short correct
options / trim long distractors in `pipeline/cards/*.json`.

### B6 · ✅ DONE · The 7 cloze cards are never validated at all
They bypass the authored-card rules: 4 are mis-topiced, 1 is a bullet fragment, 1
is garbled OCR, and 3 duplicate an authored MCQ. Seven cards is small enough that
deleting the bad ones is defensible — `HANDOVER.md` already notes the book has few
clean self-contained number facts. Per the governing rule, a missing card beats a
wrong one.
*Files:* `pipeline/src/cloze.ts`, `pipeline/src/cards.ts`.

### B7 · ⚠️ PART DONE, PART REJECTED ON EVIDENCE · The `shared` filter
Worse than first reported. Of **32 identical-label groups, 27 are partially flagged
and 5 have no member flagged. None is flagged group-wide.** What actually holds the
"one deck sign per printed caption" property today is the exact-label de-dup plus
`CLEAN_LABEL` plus the crop filters — three unrelated filters happening to coincide,
not a rule anyone wrote. It holds *now* (25 groups → 25 single members, 0 with two)
and will stop holding the moment any one of the three changes. B2 is what it looks
like when a single OCR glyph defeats the coincidence.

**DONE: the edit-distance-1 label floor** is in `e2e-app.ts` — no two deck labels may
be one glyph apart. Distance 1 and no higher, deliberately: "No lorries" / "No buses"
differ by more, and genuinely distinct signs must survive. The helper was self-tested
on 9 cases, including that it fires on `traffic`/`traftic` and does **not** fire on
`no lorries`/`no buses` or `traffic signals for buses`/`for bus`.

**REJECTED on measurement: making `shared` group-wise.** I measured it before
implementing, and it would **drop 28 signs that are currently in the deck**. In a
partially-flagged group the member with `shared: false` is the one sitting under the
printed caption — it legitimately owns the label, and the de-dup already keeps
exactly one per caption, which is the correct outcome. Changing the semantics would
be a regression, and it works directly against B11/B12's aim of growing the starved
sections. The audit was right that the property rests on a coincidence of three
filters; it was wrong that group-wise `shared` is the remedy. The edit-distance floor
is what actually stops B2 recurring, because exact-label de-dup cannot catch a
one-glyph difference by construction.

Not done: disambiguating suffixes for the five big group labels. That is authoring
text the book does not print, so it needs a human with the regulations — see the note
in `sign-label-corrections.json`.
*Files:* `pipeline/src/e2e-app.ts` (done), `pipeline/src/cards.ts` (unchanged, on
purpose).

### B12 · ⚠️ MOSTLY DONE · Correct the wrong in-deck sign labels, and recover the recoverable signs
`sign-labels.md` validated all 357 signs against the printed captions, reading the
sheet pages cropped at native 2481 px and matching labels to captions
**geometrically** via the crop rectangles — which is what catches a label shift
rather than a spelling error. Deck membership was reproduced independently from
`usableSigns()` and agrees with `cards.json` on all 243 ids and 114 exclusions.

**206 of 243 in-deck labels (84.8%) are exactly right; 16 are actually wrong.**
Full counts, all 357 / in-deck: correct 218/206 · shared-label 74/21 · garbled
28/13 · truncated 20/2 · wrong-sign 8/0 · no-label 7/0 · ambiguous 2/1. Note
wrong-sign is **0 in the deck** — no in-deck card shows one sign under another
sign's name.

Three actions, in order of value:
1. **Correct the 16 in-deck labels in place**, every reading taken off the page —
   led by `Traftic → Traffic` (which is B2), `FO CE → Police`, `Water sking → Water
   skiing`, `Sports → Sports centre`, plus five where an on-face legend leaked into
   the label (`Mostellsbar`, `5,2 km`, `RYMI` ×2).
2. **Recover ~25 out-of-deck signs** the same way — about **+50 cards, weighted
   towards the thin sections**, which is the cheapest available fix for B11's
   inverted deck weighting. Three of them are excluded only by `CLEAN_LABEL`'s
   length/charset shape rather than by any defect at all (`Bank` is 4 characters).
   ~~`007-012` is restorable immediately: correct, unique label, wrongly flagged
   shared.~~ **See the two corrections below — this claim and the `010-024` one are
   both refuted on measurement.**
3. Then B7's group-wise `shared` filter and suffixes.

**✅ APPLIED — actions 1 and 2, measured on the tree of 2026-08-05.** Re-measured
before applying, because the audit's counts had gone stale in both directions: **17**
in-deck labels were wrong, not 16 — 15 of the audit's 16 still wrong (B2's `Traftic`
had already gone, dropped by the de-dup once its correction landed), plus **2 post-B1
regressions the audit rated `correct`** (`005-006`, `008-062`; both on-face-legend
leaks, now recorded as **B1-r1** for the crop-gate owner). B1's caption clip had
already fixed **10** of the audit's targets, not the 6 `HANDOVER.md` names.

- **27 label corrections applied** to `pipeline/cards/sign-label-corrections.json`
  (17 in-deck fixes, 9 recoveries, 1 defensive no-op on `p009full-s019` so the
  duplicate-label rule rather than the `shared` flag is what keeps B2's second member
  out). Every reading was taken off a page band at native resolution; all 27 crop
  keys were re-verified against today's `dataset.json` before applying, and the
  neighbour order of every affected sheet row was re-checked left-to-right.
- **6 `GARBLED_LABEL` exclusions deleted** — `p003full-s017`, `p005full-s031`,
  `p008full-s003`, `p008full-s040`, `p010full-s007`, `p010full-s020`. In each case
  the label is now read off the page, so the reason the exclusion recorded has
  evaporated; the crops themselves were opened and are clean and complete.
- **`CLEAN_LABEL` length bounds 5–71 → 4–78** in `cards.ts`, on its own measurement:
  each candidate was run over all 357 labels and each newly admitted label read off
  the page. Min-length 4 admits **exactly one** label in the whole corpus (`Bank`);
  the 78 cap admits **exactly one** (`010-003`, 77 characters, identical to the
  printed caption so it needs no correction). The 90 cap and the `"` charset change
  were both measured and **rejected** — see the distribution in the comment beside
  the rule.
- **Deck: 252 → 263 signs, 504 → 526 sign cards (+22), 0 signs displaced.** The
  correction/exclusion work alone is +9 signs / +18 cards (252 → 261 / 504 → 522, as
  predicted); the `CLEAN_LABEL` change adds the other +2 / +4. Authored MCQ (247) and
  cloze (5) are untouched; total 756 → 778.
- **B11 payoff, measured per section:** Lane markings 3 → 5, Road markings 8 → 11,
  Supplementary 28 → 31, Instruction 7 → 8, Route and direction 14 → 15, Service
  78 → 79 (the one Service gain is `Bank`). Nothing else moved. 20 of the 22 new cards
  land outside the over-weighted Service section.
- Suites: `typecheck` clean, `cards -- --strict` exit 0, `test:e2e` 192 green,
  `test:app` 97 green, near-duplicate floor still **0 violations** with the
  `Blind rise`/`Blind rises` and `Direction arrow`/`Direction arrows` families all
  still present as distinct signs.
- **Sign ids did not move.** `sign-id-baseline.json` still matches on all 357 ids
  (0 gone, 0 new, 0 re-pointed) and no `--update-ids` refresh was run or needed: ids
  are hashed in `dataset.ts` from the *OCR* caption plus section, and label
  corrections are applied downstream in `cards.ts`, so a corrected label leaves the
  id alone. 17 in-deck ids therefore now carry a corrected label **for the same
  crop** — study history stays attached to the sign it was earned on, and no id
  points at a different sign. That is better than the orphaning that was expected,
  but it is worth knowing it is a property of *where* corrections are applied, not a
  guarantee: if the hash ever moved to the corrected label, all 27 would orphan at
  once. The comment beside `ID_BASELINE` in `dataset.ts` claimed the opposite — that
  "a label correction" is a change meant to move ids, to be absorbed with
  `npm run dataset -- --update-ids` — which the code contradicts. **Corrected**, with
  the reason and the file/line evidence, and with the baseline's OCR-string nature
  written down beside it.

**Two claims in this entry are refuted on measurement — do not go after them.**
1. **`007-012` is not "restorable immediately".** The premise is right (its label is
   correct and unique among non-excluded signs), but its *only* blocker is
   `shared: true`, and `shared` is set in `layout.ts` and read from `dataset.json`.
   `usableSigns()` checks it **after** `CLEAN_LABEL`, so nothing B12 owns
   (`sign-label-corrections.json`, `sign-exclusions.json`) can clear it. Restoring it
   needs the group-wise `shared` derivation, which **B7 records as rejected on
   measurement** because it would drop 28 signs currently in the deck. The two p007
   group-caption recoveries above take Lane markings from 3 to 5 without touching
   `shared` at all, which is the same win by a different route.
2. **`010-024` is not recoverable by the charset change.** `sign-labels.md` §6 rates
   "`Bank` and `010-024` are individually safe"; `Bank` is, `010-024` is not. Allowing
   `"` in `CLEAN_LABEL` admits exactly one label — `Advance warning of "Give-Way"` —
   and that sign is also `cut`, which is checked after `CLEAN_LABEL`. The charset
   change buys **zero** signs. `010-018` (`"Give-Way" line`) is the only sign it could
   ever admit, and that one needs the quote characters in its reading.

**Recorded, deliberately not attempted — do not rediscover these.**
- **`002-013`…`002-017`** (the five give-way triangles) need a `CLEAN_LABEL` cap past
  84 **and** a decision that joining a group caption to a sub-caption *in the reverse
  of the printed order* counts as reading rather than authoring. The ceiling is 3
  signs, not 5 (two sub-captions occur twice), and Warning Signs already has 34 deck
  signs, so the B11 payoff is ~0. Out of scope for B12.
- **Refusals honoured, every one for the same reason — a reading of the crop, never a
  guess at the OCR.** `004-017` (sentence boundary unreadable, see below);
  `008-064` — the audit's "safe one-glyph fix" `Orgamized → Organized` **is not one**:
  at 8× the page appears to print `Orgamized`, so it is either the book's own typo or
  a defect of the photograph, and it cannot be read away (if the sign is wanted, the
  honest route is to delete its `GARBLED_LABEL` exclusion and ship the book's
  spelling); `010-010` — the reading is certain but recovering it is exactly what
  makes it a visual twin of in-deck `010-002` at the app's render size; `005-012` —
  reading certain, crop clipped mid-panel, and its clean twin `005-031` was recovered
  instead (its exclusion reason is more honestly `BAD_CROP` than `GARBLED_LABEL`).
- **Also refuted:** "6 of the 16 in-deck defects are the column-interleaving and
  caption-boundary bugs wearing different hats" (below) is wrong as written. Sign
  pages never reached the column-detection path at all, so nothing in this class was
  ever waiting on C5;
  `006-059`/`006-063` are neighbouring captions on the same sheet row read in one
  pass, which is a sign-sheet caption-boundary problem.
- **Watch list, not a defect.** Three Road-markings pairs are now mutual distractors
  inside one section and are separated only by dash geometry. None is a wrong card —
  every label is printed on the sheet and every meaning is distinct — but they belong
  on the same "distinguishable but hard" list as `008-068`/`008-070`, in this order:
  1. **`010-004` / `010-007` — the closest pair in the section, and the one to watch.**
     `010-004` (`Half-broken centre line with unbroken central line`) was already
     in-deck; `010-007` (`Overtaking permitted for traffic within broken lane line`) is
     new, so the pair only exists because of B12. Both draw a continuous white line
     running the full width with wider blocks stepping up off it, and at the app's
     198×176 the shapes rhyme. What a learner can actually use, read off both crops at
     8×: on `010-004` the blocks are **long and the gaps between them narrow** — four
     of them, nearly meeting, so the marking reads as an almost-solid double line, and
     the continuous line beneath is a **thick band** (the "unbroken central line" its
     caption names). On `010-007` there are **three short blocks with long gaps**, so
     the marking reads as plainly interrupted, and the continuous line beneath is
     **thin**. Filled-versus-interrupted is the discriminator that survives being
     shrunk; block count and line thickness are the confirmations. It is a real
     distinction the sheet teaches, but it is the weakest one on this list.
  2. `010-003` / `010-006` — `Half-broken` (long dashes, short gaps) against `Broken`
     (short dashes, long gaps). Separated by exactly the dash-to-gap ratio the two
     captions name, and 13 edits apart.
  3. `010-003` / `010-007` — both long-dash; `010-007` additionally has the step and
     the continuous line, `010-003` is a uniform single dashed line.
- **The sign-id baseline records OCR strings, not what the deck teaches.** Because ids
  are hashed from the OCR caption (see the note now in `dataset.ts` beside
  `ID_BASELINE`), `sign-id-baseline.json` still reads
  `umferdarmerki-enska:6full:1u74i2b → "FO CE"` for the card that ships as `Police`,
  and the same for all 27 corrections. **This is not a defect and must not be
  "fixed"** — the baseline's only job is proving ids are stable across a rebuild, which
  it still does exactly (357 ids, 0 gone, 0 new, 0 re-pointed). It is recorded here
  because a reader who mistakes it for a label inventory will conclude the deck ships
  garbled labels. `app/data/cards.json` is the record of what the student sees.

**The line not crossed, and it should stay uncrossed:** `004-017` ("Place for
allowing oncoming traffic to pass parking prohibition", in deck) is verbatim — every
word is present — but the report could not read whether it is one sentence or two,
so **no correction is proposed**. That is the difference between reading the crop and
guessing at the OCR.

Also worth knowing: **6 of the 16 in-deck defects are the column-interleaving and
caption-boundary bugs wearing different hats**, so C5 and B1 will fix part of this
class upstream. Sequence B12 after them and re-measure rather than correcting all 16
by hand first. — **Refuted on measurement; see "Also refuted" above. Sign pages never
reach the column-detection path, so no part of this class was waiting on C5. The advice to
re-measure first was right and was followed.**
*Files:* `pipeline/cards/sign-label-corrections.json` (1 → 28 entries),
`pipeline/cards/sign-exclusions.json` (27 → 21 entries),
`pipeline/src/cards.ts` (`CLEAN_LABEL` bounds only),
`pipeline/src/dataset.ts` (the `ID_BASELINE` doc comment only — no code).
*Check:* `npm run cards -- --strict` reports `526 sign` and `sign images staged: 263`;
`npm run test:app` stays 97 green with the one-glyph floor at 0 violations.

### B8 · S3 · Citations resolve but 15.9% land mid-sentence
All 252 resolve — nothing is orphaned. But 40 cited chunks start lower-case, 34 are
better supported by a neighbouring chunk, and 5 cite a list lead-in whose answer is
in the next chunk (`ch-7-a-12`, `ch-7-a-17`, `ch-7-a-21`, `ch-8-a-12`). A merge
pass over adjacent chunks in `dataset.ts` fixes the class rather than each case.

**44 citations were read against the source and all 44 are correct. Zero wrong
answers were found anywhere in the corpus** — this is a precision problem in where
"See it in the book" lands, not a correctness problem.

**Full sweep 2026-08-06, all 247 authored cards** — the class `cards --strict`
structurally cannot see: a card citing an existing-but-wrong chunk. Result: **234
SUPPORTED, 13 SUPPORTED-but-fragmented (this class, tolerated), 0 PARTIAL, 0
UNSUPPORTED.** `ch-7-a-21` (B16) was the only real defect found and is now fixed.
The 13 fragmented, left as-is: `ch-1-2-a-20`, `ch-4-b-07`, `ch-4-b-15`,
`ch-4-c-09`, `ch-5-a-11`, `ch-5-b-08`, `ch-5-b-14`, `ch-7-a-12`, `ch-7-a-13`,
`ch-7-a-17`, `ch-8-a-12`, `ch-8-b-11`, `ch-7-a-21` (the last, its fixed citation,
lands on a `list`-kind chunk — still fragmented by this class, but supported).
*Files:* `pipeline/src/dataset.ts`.

### B9 · ✅ DONE · Four semantic duplicates
Three are `appendix-a` re-testing a fact already in `ch-3-a`.
*Files:* `pipeline/cards/appendix-a.json`.

### B10 · S2 · Coverage is uniform by document and badly skewed by topic
Density is even across documents (4.24–5.66 questions per 1k words), so nothing is
neglected wholesale. The skew is by **topic**, and of 168 substantive pages **26
have zero questions and 29 more have exactly one**.

Worst topics: animals **1**, roundabout **2**, gravel **5**, occupants **6**. The
words "sheep", "reindeer" and "crosswind" appear **zero times** across all 252
questions — for a test taken in Iceland, that is the most consequential gap on the
list. Motorway **0** is defensible: Iceland has none.

The ten highest-value targets, with chunk ids ready to author against:

| # | Where | What is missing |
| --- | --- | --- |
| 1 | ch-3 p35 | green/red arrow combinations, lights-failed rule (`ch-3:9b:12iszct`, `1dgt74`, `kyynog`, `b0ecn3`) |
| 2 | appendix p155 | sheep, reindeer, side wind, unsecured road edge, tunnels (`appendix:1b:b4l182`, `1pr1vat`) |
| 3 | ch-4 p51 | obstacle-on-road right-of-way, accel/decel lanes — 5 rules, 0 questions |
| 4 | ch-3 p31 | pedestrian-crossing halt duty, prohibited area |
| 5 | ch-3 p18 | road / junction / carriageway / lane definitions |
| 6 | ch-5 p96 | six towing duties; only rope length, speed and neutral are covered |
| 7 | ch-5 p97 | battery, airbag, brake-system, engine-management warning lights |
| 8 | ch-1-2 scan 3b | licence-category table — B, AM, BE |
| 9 | ch-7 p131/132 | fitness to drive, glasses and reaction time, defensive driving |
| 10 | appendix p169/168, ch-5 p83 | single-lane bridge, unbridged rivers, *seinfarinn vegur*, *torleiði* |

62 prioritised targets in total, all with chunk ids and `site/` pages, in
`questions.md` §4.
*Files:* `pipeline/cards/*.json` (new authoring).

### B11 · S3 · The sign deck is weighted inversely to what the test asks
Service signs contribute 138 cards — **18.5% of the whole deck** — while the
sections a test actually leans on are starved by the exclusion filter: Lane
markings keeps 3 of 31 signs, Traffic signals 7 of 17, Instruction 7 of 19. The
student drills camping pictograms and barely sees lane markings. Recovering
excluded signs in the thin sections (see C5) is worth more than any new Service
card.
*Files:* `pipeline/cards/sign-exclusions.json`, `pipeline/src/cards.ts`.

---

## C. Transcription and the book edition

Sample: 24 pages across all nine documents — 16 suspects, 8 random controls —
plus 3 sign contact sheets, backed by two whole-corpus read-only scans to ground
the frequency estimates. Verdicts: 11 broken, 2 moderate, 8 minor, 3 clean.
Suspects were far worse than controls (10/16 against 1/8), so the suspect list in
`HANDOVER.md` is accurate. Full detail: `scans.md`.

### C1 · ✅ DONE · Every page number in the published table of contents is off by one
Verified by cross-checking each section against its actual folio: the site says
Hazard signs 20, Prohibitive 21, Road surface markings 27; the truth is 21, 22,
28. This is the only place in the edition that asserts a plainly checkable
falsehood — everywhere else a defect makes text unreadable rather than wrong. It
is also related to C4 but is a distinct bug: the numbers are not merely glued to
the wrong entries, they are uniformly shifted.
*Files:* `pipeline/src/layout.ts`.

### C2 · ✅ DONE · ch-4 p.74 — two lists with opposite legal force merged into one
The heading "A car may be stopped, but not parked:" is swallowed by the last
bullet of the preceding stop-*and*-park prohibition list. So "On a bridge" now
reads as a **stopping** prohibition, which the book explicitly denies. A student
reading the published page learns the opposite of the rule.
*Files:* `pipeline/src/layout.ts`.

### C3 · ✅ DONE · Ordered lists restart at 1, renumbering keyed procedures
The 18-item dashboard-warning-light legend on ch-5/ch-6 p.97 is split into seven
`<ol>` blocks that each restart at 1, so **15 of 18 numbers are wrong** — and the
figure they key into is not published at all, so the legend is both misnumbered and
unmoored. Six pages book-wide carry this defect, including the **4-step Red Cross
procedure on ch-8 p.141**. Renumbering a first-aid sequence is the worst case on
this whole list.
*Files:* `pipeline/src/layout.ts`, `pipeline/src/build-html.ts`.
*Done when:* a multi-block numbered list continues its numbering across the blocks.

### C4 · S2 · Sign sheet p005 and p010 — wrong and unanswerable sign cards
On p005 a sliced shield fragment inherits the "boundary sign (large)" label while
the genuine "(small)" sign is never detected. On p010 two road-marking crops are
visually identical but carry different labels — as cards they are unanswerable, and
the student is marked wrong for a correct reading.
*Files:* `pipeline/src/layout.ts`, `pipeline/cards/sign-exclusions.json`.

### C5 · ✅ DONE, WITH FOUR RESIDUALS (`C5-r1`–`C5-r4`) · Column interleaving

**Implemented 2026-08-05 in four stages, against `plan-column-interleaving.md`.**
`detectColumns` is gone; `frameCut` replaces it — an exact vertical sweep with a
straddle tolerance, recursing once into each half — wired into `proseBlocks`.
`paragraphize` breaks an ordered-list run when the printed enumerator stops counting
up, and `sameBaselineOrder` re-orders same-baseline fragments by `x`.

**The prize landed.** ch-4 p.66's 172-word `<figcaption>` is now
`ch-4:15a:1j4ltjx`, a 940-character `kind: para` chunk carrying 50, 30, 90% and
20%, cited by three cards. Measured, whole corpus: cross-frame chunk contamination
**157/1,405 = 11.2% → 12/1,276 = 0.94%**; longest `<figcaption>` **172 → 45 words**;
sections 98 → 91, chunks 2,074 → 1,944; `test:e2e` **189 → 192 green, no floor
lowered**; sign ids byte-identical throughout (357 pairs, 0 diffs).

**The predicted cost was paid: 33 citations re-pointed, 2 dropped** —
`appendix-a-09` and `appendix-a-10`, whose facts now survive only as figure
captions (see "Known imperfections" in `HANDOVER.md`; their ids must never be
reused). `test:app` reads `247 written, 247 shipped`.

**One guard was recalibrated, and it was not a quality floor.** Stage 0's
anti-vacuity guard `testable >= 1300` was set from the pre-fix denominator of 1,405
on the same day; merging interleaved fragments necessarily shrinks that denominator
(to 1,276), so no correct implementation of the fix could pass it. It was replaced
with `purity.pages >= 120` — a count of pages the sweep cuts, measured 149, and
invariant to how the pipeline groups lines into chunks. **The 189 pre-existing
floors were untouched and stayed green.**

*The record of what the plan predicted, kept because the residuals are argued
against it:*

**Scope was much larger than anyone thought: 51 of 175 prose pages (29%), 36 of them
severely** — 7× the suspect list in `HANDOVER.md` and 2.4× the audit's own estimate.
Per document: ch-4 14, ch-5 8, ch-6 7, ch-8 7, ch-3 5, ch-1-2 4, appendix 3, ch-7 3.
Criterion: the page splits into ≥2 frames, the shipped code merges them, and there is
at least one *splice* — a run of minor-frame lines with major-frame lines above and
below in y.

**The root cause was not "there is no clustering".** `detectColumns` existed and worked
on 90 pages (it has since been deleted). It failed through four compounding bugs:
`floor`/`ceil` bin inflation eats
2 of the 6 required empty bins (25 pages); `g.length >= 3` discards 2-line frames and
collapses the page (4+); no straddle tolerance, so one line crossing the corridor
zeroes the evidence (19 pages — on ch-4 p.38 the chapter title `Driving in traffic`
bridges the frames and the corridor vanishes); and the 0.12 search band finds the page
margin first.

**Fix: keep the whitespace-corridor idea, make it robust** — an exact sweep over
boundary positions with a straddle budget. `WIDE = 0.60`, window `[0.30, 0.70]`,
`GAP_MIN = 0.004`, `CROSS_MAX = 3`, `MIN_LINES = 2`. **What shipped widened the window
to `[0.22, 0.78]`** (Stage 2): the plan's window changes no page's partition on its own
(measured, 0 of 178), and the width exists for the recursed halves, whose corridors sit
outside it — appendix p.165's centres at x 0.2751, p.166's right half at 0.7214.

The `WIDE` change matters most and is properly evidenced: 4,127 lines fall in
0.50–0.60, **3** in the 0.60–0.62 valley, 41 at ≥0.62. **The shipped `WIDE = 0.55`
sits inside the body-line distribution** and discards 20% of the evidence — it works
by accident. Sensitivity: the two-frame page count is 143 at 0.55, 142 at 0.58, 0.60
and 0.62, 141 at 0.65, 139 unfiltered — flat across the valley, which is what a
well-placed threshold looks like.

Alternatives rejected on measurement, not taste: left-edge histograms **over-split 24
pages**; connected components merge the frames on exactly the pages that are bridged;
an ink projection profile is not computable at all (no pixels in derived data) and
would import the justified-spacing confounder that line boxes are immune to.

**Honest gap in the plan, flagged by its author:** `GAP_MIN` has **no valley** —
corridor width is continuous from 0.004 upward — so that threshold rests on one
failing page (ch-4 p.54, real corridor 0.0080) rather than a distribution. Treat it as
the least-supported number of the five.

**Evidence it works, from the scratch build:** `test:e2e` **189 green, no floor
lowered**, `tsc` clean, **sign card ids byte-identical** (357 id|label pairs — the
sheet uses `buildSignPage`, which never took the column-detection path), and **0 of
175 pages loses a split it has today**. The prize: **ch-4 p.66's 172-word
`<figcaption>` becomes a 940-character citable prose chunk with 50/30 km/h and
90%/20% intact** — the book's most-tested numbers, then uncitable. Longest figcaption
172 → 45 words; cross-frame chunk contamination **11.3% → 1.1%** in the plan's
figures, which becomes the new e2e floor. *As built, this code measures 11.2% → 0.94%
and the floor shipped at 2.5%.*

**Cost, and it must be paid in the same commit: 34 authored citations re-point.** 25
mechanical, 7 needing a human choice, 1 that now lives only in a figure caption, 0
without any target. Until they are fixed `cards --strict` exits 1 and `test:app` fails
`249 written, 215 shipped` — the guards do their job. Note **17 of the 34 currently
cite interleaved garbage**, so this improves those questions' sources rather than
merely moving them. *As built: 33 re-pointed and 2 dropped, not 34 re-pointed — two
questions' facts turned out to survive only as figure captions, with no chunk anywhere
carrying them (verified corpus-wide), so re-pointing would have attached a true
question to a chunk that does not support it.*

**Two companion fixes the frame fix exposes**, both required:
- an ordered-list run must break when the printed enumerator stops counting up —
  without it `test:e2e` drops to 188/189 on ch-4 p.46;
- same-baseline fragments need an x tie-break. That, not column merging, is
  **ch-1-2 p.13's entire residual damage** — confirming the audit's downgrade of that
  page, and correcting `HANDOVER.md`.

**Do not batch this with C11/re-OCR.** The plan excludes it deliberately. *That still
holds for the residuals below.*

It was the largest known open item, and the audit found it was **the upstream cause of
three other defect classes**, not just a readability problem: lines were ordered by
`y` across the full page width instead of being clustered into columns first, so a
marginal sidebar got spliced word-by-word into the body column. **That mechanism no
longer exists** — `frameCut` clusters first and `mkColumn` orders within a frame.

The consequence that mattered most: on **ch-4 p.66 the 50/30 km/h urban speed limits
and the 90%/20% pedestrian-survival statistics ended up inside a 172-word
`<figcaption>` on a speed-bump drawing**, which is why the dataset had no citable
chunk for the most-tested numbers in the book and the authoring packets had to skip
them. **Fixed** — the passage is `ch-4:15a:1j4ltjx` and B10's authoring is unblocked.

Corrections to the suspect list in `HANDOVER.md`:
- **Add** ch-8 p.150 (a severe-bleeding instruction) and appendix p.165 — both
  interleaved, neither previously recorded.
- **Remove** ch-1-2 p.13 — much milder than documented.
- Confirmed as listed: ch-3 Figure 3.37, ch-5 p.95, ch-4 p.38 and p.54.

#### C5-r1 · residual after stage 2 · appendix p.165's right half — blocked by `CROSS_MAX`, not by depth or ordering

Stages 0–2 are in. Appendix p.165 (`Appendix-p006b`, `appendix.html#p-6b`) now comes
apart into three frames and its left description column reads correctly. **Its right
half does not**, and the published text still carries a wrong reading:

> …contains information about the name of the destination, the road number and the
> distance **Gbr-Midbar** to the destination in km.

`Gbr-Midbar` is a place name printed on the sign face beside that paragraph, not part
of the sentence. Six more splices sit in the same frame — `Settjarnarnes`,
`Reykjavik Kringla (`, `CAD 0 Keflavik`, `Kopavogur`, `200) Kirkjubelar-/klaustur`,
`Geirland`, `Vik`.

**Measured cause: 4 straddlers against `CROSS_MAX = 3`.** The corridor is real and
wide enough — sign faces end at x 0.6990, the description column starts at 0.7091, a
gap of 0.0101 against `GAP_MIN = 0.004`. Over the whole sweep window the fewest
straddlers any feasible position achieves in this frame is **4**, at x 0.6990, and all
four are the lines of one paragraph that runs the full width of the frame:

```
x 0.5179 w 0.3751  Primary traffic routes, usually put close to junctions
x 0.5155 w 0.3566  e.g, on a bridge. The sign has one arrow for each
x 0.5181 w 0.3695  driving lane, and it contains information about the
x 0.5152 w 0.3908  name of the destination and the road number where
```

Each is under `WIDE = 0.60`, so `WIDE` does not exclude them, and each spans every
candidate x in [0.518, 0.893]. One over budget.

**Neither planned stage clears it, both checked:**
- *Not recursion depth.* `VERTICAL_DEPTH` 3 and 4 change **no partition anywhere in
  the corpus** (0 of 178 pages). There is no second corridor to find.
- *Not stage 3's same-baseline tie-break.* Its rule (vertical overlap ≥ 0.75·min(h),
  x-overlap ≤ 0.012, consecutive x-gap ≤ 0.03) does not pair `Gbr-Midbar` with the
  line it interrupts: the x-gap is **0.0457**, over the 0.03 limit. Evaluated against
  every line in the frame, the rule pairs only `Kopavogur` (x-gap 0.0129) and
  `200) Kirkjubelar-` (0.0207), and reordering those two by x moves each splice one
  position without lifting it out of the prose. The wrong reading above survives
  stage 3 untouched.

**Measured candidate fix: `CROSS_MAX = 4`**, which admits this corridor exactly.
Plan §3.2 measures the degradation point at 5 (`CROSS_MAX = 5` first mixes ch-3 p.20's
body sentence into its minor frame) and §8 makes 4 a follow-up rather than part of any
stage, **conditional on reading two pages first: ch-5 p.86 and ch-6 p.101**, whose
minor frames 4 newly admits. Do not raise it without that pass — the whole reason the
number is 3 today is that every frame it admits was read.

*Files:* `pipeline/src/layout.ts` (`CROSS_MAX`).
*Done when:* p.165's right half separates the sign faces from the descriptions, ch-5
p.86 and ch-6 p.101 have been read and recorded, and the e2e floors hold.

#### C5-r2 · residual after stage 2 · appendix p.165 lost a real heading, and no planned stage fixes it

Stage 2's third frame on p.165 cost the page its `<h2>`. `Route and direction signs`
— a genuine heading, listed in the book's own contents for p. 165 — now publishes as
`<p class="uncertain">Route and direction signs 711/ Vatnsnes</p>`, and section
`s:appendix:6b:ebmy9g` is gone from the dataset. Nothing false is published and no
text is lost; the page loses a navigation anchor.

**Measured cause, and it is not "the lines sit at the same y".** They sit at
y 0.1175 / 0.1507 / 0.2251. The new frame is a 7-line sparse column of isolated sign
labels, so `paragraphize`'s `medGap` is **0.0422** — ten times a body column's — and
the blank-line test `gap > max(medGap*1.7, bodyH*0.55)` needs 0.0718 where the real
gap is 0.0345. It never fires. All three lines classify as `isHeading`, group
together, then fail `g.lines.length <= 2` and fall through to a paragraph.

Stage 3 cannot reach it: its rule needs vertical overlap ≥ 0.75·min(h) and these
lines share no baseline. And it is not the plan's **§5.5** class that stage 1 first
logged it under either — §5.5 lists no heading class at all; that attribution, still
standing in the middle of the stage-2 report, is retracted here.

**The obvious fix was measured and rejected.** Breaking a heading group on an
absolute y-gap is well supported on its own terms — over all 30 consecutive
heading pairs in the corpus that group together, `gap / bodyH` runs −3.24 … +0.53 and
then jumps to +2.26 and +2.52, a wide empty band, and the two pairs above it are both
sparse-frame accidents. But adopting it (`gap > bodyH * 1.4`) takes sections 91 → 93
with **three changes beyond the target**:

```
GAINED  s:appendix:6b:ebmy9g  "Route and direction signs"   ← the one wanted
GAINED  s:appendix:6b:o056nx  "711/ Vatnsnes"               ← sign lettering, a false heading
LOST    s:appendix:1a:1e68ctc "Traffic signs. Hazard signs"
GAINED  s:appendix:1a:vuxj4j  "Hazard signs"
```

It re-creates the spurious `711/ Vatnsnes` heading that stage 2 had just removed, and
on appendix p.154 it splits a second glued pair, promoting `Hazard signs` correctly
but demoting the appendix's own title `Traffic signs.` to a paragraph (it ends in a
period, so `looksLikeHeading` rejects it). One heading recovered, one invented, one
demoted — not a win, and not this stage's page. Reverted rather than shipped.

Three coupled defects, and the y-gap rule is only the first: `looksLikeHeading`
admits sign lettering like `711/ Vatnsnes`, and rejects a real title that ends in a
period. All three want measuring together, with the section list diffed corpus-wide.

*Files:* `pipeline/src/layout.ts` (`paragraphize`'s group break, `looksLikeHeading`).
*Done when:* p.165 and p.154 both carry their real headings, and no section appears
or disappears anywhere else in the corpus.

#### C5-r3 · residual after stage 3 · a sign-face word ordered into the middle of a sentence, and no threshold separates it

Stage 3 is in: 62 same-baseline runs found, 32 re-ordered, on 21 pages, all read.
Twelve pages improved, six are neutral, **three got worse** — and two of the three are
on one page, `Appendix-p008b` (appendix p.169, `appendix.html#p-8b`):

```
before  …used in combination with a warning sign to alert the driver that the
        single lane (2.8ml EINBREID BRU bridge ahead is narrower than 3,05 meters.
after   …with a warning sign to (2.8ml alert the driver that the single lane
        EINBREID BRU bridge ahead is narrower than 3,05 meters.

before  <figcaption>…has only one driving lane that is shared for both
        directions. BREID GONG</figcaption>
after   <figcaption>…that is shared for both BREID GONG directions.</figcaption>
```

`(2.8ml` and `BREID GONG` are legends printed on the sign face left of the description
column. Nothing false is created and no fact, number or card is touched — but an intact
sentence now carries an intrusion mid-clause, where before it carried one at a
paragraph boundary. The third regression is `Ch. 5-p005b`, where a two-character
left-margin artefact (`'s`) moves into the tail of a clean sentence.

**The discriminator, stated as a controlled experiment.** `Appendix-p008a` and
`Appendix-p008b` are the same construction with opposite outcomes:

```
p008a  "200 m" before "Distance to danger or area covered by"   → sentence repaired
p008b  "BREID GONG" before "directions."                        → sentence broken
```

Identical objects, identical geometry class. The one difference is that **p008a's
partner line opens its paragraph and p008b's partner lines continue one.** That is
paragraph role, and it does not exist when `mkColumn` runs — it is `paragraphize`'s.
Any fix belongs there, or in an ordering pass that runs after paragraph assembly.

**Four cheaper detectors were measured and rejected. Do not re-try them:**
- *Tightening `FRAG_V_OVERLAP`.* Over every pair the two x tests admit, accepted v runs
  0.7500–1.0000 and rejected v reaches only 0.7362, so 0.75 already sits in an empty
  band. `BREID GONG` is 0.7515 and `Appendix-p010b`'s `SVR STOP V` — a true positive
  that repairs a sentence — is 0.7775: only a value in (0.7515, 0.7775] separates them,
  a hair from one example. `(2.8ml` is at 1.0000 (identical `y` *and* `h`) and no
  overlap cut can reach it at all.
- *Tightening `FRAG_X_GAP`.* `(2.8ml` sits at 0.0220, **below** winning re-orderings at
  0.0243 (`Ch. 5-p011b`) and 0.0249 (`Appendix-p008a`, `Ch. 5-p006a`), so it is
  strictly dominated: no gap cut removes it while keeping those. Removing
  `Ch. 5-p005b`'s `'s` needs a cut in (0.0274, 0.0283], which costs `Ch. 5-p006a`'s
  clearest caption join at 0.0274.
- *Crop containment* (is the moved line inside a detected sign/figure rect?). Measured
  signed distance to every crop rect for all 32 re-orderings: the apparent separation
  is an artefact of **sign-detector coverage, not physics**. `Appendix-p008a`'s winning
  `200 m` is the same kind of object as `BREID GONG` and escapes containment only
  because that sign was never cropped, so the rule would silently flip whenever
  `npm run figures` re-runs. It also kills the plan's third defining case
  (`11 12 13 14 15 16 | 17 18`) and one of `Ch. 5-p006a`'s wins, and does nothing for
  the `'s`.
- *Line-height ratio, OCR confidence, and a geometric continuation-line proxy.* None
  separates the sets; the last vetoes the plan's own defining case 2
  (`Ch. 1–2-p005b`'s fatigue list).

*Files:* `pipeline/src/layout.ts` (`paragraphize`, or a post-paragraph ordering pass) —
**not** `sameBaselineOrder`'s constants.
*Done when:* p.169's two descriptions read unbroken with their sign legends outside the
sentence, `Appendix-p008a`, `Appendix-p010b`, `Ch. 1–2-p005b`, `Ch. 5-p010a/b`,
`Ch. 6-p011a` and `Ch. 7-p006a/p008a/p008b` still read correctly, and the e2e floors
hold.

#### C5-r4 · residual after stage 3 · the column order is right and the page order is not — aside blocks are re-sorted by `y`

`layout.ts:1237–1238` (`proseBlocks`) emits the non-main columns as
`extras.sort((p, q) => p.y - q.y)`. When a same-baseline run is split by `paragraphize`
into more than one block, that sort re-scrambles exactly what stage 3 had just ordered.

**ch-4 p.54 (`Ch. 4-p009a`) is the demonstration.** After `mkColumn` the five fragments
are in the right order — `driving`(x 0.1875), `lane.`(0.2551), `And`(0.3063),
`the`(0.3555), `driver`(0.3861), all at y 0.7722–0.7743. `paragraphize` then cuts them
into four blocks whose first-line `y`s are 0.7218 / 0.7722 / 0.7727 / 0.7743 / 0.7743,
and the sort emits:

```html
<p class="caption">Figure 4.23 …aligns his car to the right side of the driving</p>
<p>driver performing the overtaking: 1 Checks his surroundings, …</p>
<p>And</p><p>the</p><p>lane.</p>
```

The page still improves — two correct joins and no wrong join, against one wrong join
before — but it does not read as a sentence.

**Two of the plan's predictions are therefore superseded, both "correct in the column,
false on the page":** §7 case 5's `the caption … in x order they read driving lane. And
the driver`, and §3.5b's third case `17 18 11 12 13 14 15 16` → `11 12 13 14 15 16 17
18`, which on `Ch. 5-p011b` lands in two different `<figcaption>`s.

Out of scope for stage 3, which owns line ordering only: that sort decides block order
for **every** page in the corpus, so changing it needs its own corpus-wide block diff
and its own eyeball pass.

*Files:* `pipeline/src/layout.ts` (`proseBlocks`' `extras.sort`).
*Done when:* p.54's caption reads `…right side of the driving lane. And the driver
performing the overtaking:…`, and no other page's block order changes without being
read.

*Files:* `pipeline/src/layout.ts`.
*Done when:* those pages read in correct column order, ch-4 p.66's numbers land in
a citable body chunk, and the e2e floors hold without being lowered.

### C6 · S1 · ✅ DONE — ALL THREE STAGES LANDED · Silent omission at confidence 1.00 — measured, and one instance inverted a safety instruction
**Now measured** (`dropped-words.md`): ~2.2% of pages, 4 of 184 assessable, 95% CI
0.6–5.6% — roughly **5 instances corpus-wide**, plausibly 2–12. Rare, real, and
invisible to every safeguard in place.

**Stage 1 landed 2026-08-06** (see `HANDOVER.md`): `better()` in `bookocr.swift` gained
symmetric prefix-superset handling gated on an alphanumeric tail. Full re-OCR + rebuild,
verified byte-identical control run first. 36 pages changed, 9 broken citations all
re-pointed, 0 dropped, `TAIL_OMISSION_ALLOWLIST` emptied. **ch-6 p.101 is not fixed by
Stage 1** — that line was already known to appear in neither OCR framing (see C11), so no
`better()` rule recovers it. Only Stage 3 (the containment-dedup + `OCR_PAD` change)
restores it.

**Stage 2 also landed, and every one of the plan's predicted numbers was wrong** — see
C11 below for the full account. The plan's literal Stage 2 (best-first 1:1 pairing
replacing `overlaps()`) was built and measured against a scratch corpus: 18 pages
changed, not 65; −64 net chars, not +587; chunks 1,944 → 1,936, not → 1,930; 0 sign ids
moved, not 3; 3 broken citations, not 12; duplicate pairs 42 → 39, not → 38. Record the
divergence as unexplained-but-real — **the plan's Stage 2 effect-size predictions should
not be trusted**, and by extension neither should Stage 3's (below).

The gap the plan's 1:1 model missed was **one-to-many fragment collisions**: one OCR
pass reads a line as one box, the other splits it into several, and a 1:1 best-first
match can only ever claim one fragment, sometimes the wrong one. The shipped fix adds an
x-order exact-join discriminator ahead of the 1:1 path (measured on 662 fan-out cases,
0 false positives) — see C11 for the mechanics and the corpus counts.

The one that mattered most: on **ch-6 p.101** the line `extremely careful and avoid
having our head positioned` had vanished at confidence 1.00, so the published text
read *"we must be above the battery when making the connections"* — **the opposite
of the instruction**. Its chunk is cited by `ch-6-a-13`.

**Stage 3 landed 2026-08-06 and restores it.** `OCR_PAD` gained a third framing
(`[0.04, 0, 0.02]`); `ocr()` was refactored into a reusable `mergeTwo(padded:,
plain:)` folded across all pad values; and a new `dedupContained()` post-pass
implements the plan's containment dedup, including the equal-text case at ≥ 0.5
y-overlap. `Ch. 6-p003b` (p.101) now reads at conf 1.00, confirmed in
`site/ch-6.html` and re-verified against the source scan by an independent
auditor: "…the battery might explode. For this reason, we must be extremely
careful and **avoid having our head positioned above the battery** when making the
connections." `ch-6-a-13` now cites `ch-6:3b:vdzyag`, which carries it verbatim.
The inversion is gone — **the last remaining item in the project that could teach
something false is closed.**

**A real-text-deletion bug in the plan's own containment rule was found and fixed
before shipping.** Implemented literally (y-overlap only), `dedupContained()`
deleted real text: on multi-column sign contact sheets (e.g.
`umferdarmerki_enska-p002full`, four "Dangerous bend" signs in one y-row) it
collapsed the four identical captions to one, and dropped "to right" / "to left" as
false containment hits against a different sign's "first to right" / "first to
left" at the same y but a different x. First-rebuild symptom: 63 sign ids gone / 84
new / 0 re-pointed, against a predicted ~5. Fix: an x-overlap requirement reusing
the pipeline's own existing `X_MIN = 0.50` rather than a new guessed constant.
After the fix the four signs and both direction lines are byte-identical to
baseline and sign churn is 2. **The plan's stage-3 rule as written is unsafe, and
the plan's own per-instance verification of its 19 apparent losses did not catch
it** — worth remembering next time a plan ships its own verification.

Measured, whole corpus: 121 pages changed (predicted) → **89 actual**; net lines
+11 (predicted) → **+51**; net chars +279 (predicted) → **+300**; chunks
1,940 (predicted) → **1,907→1,938**; sections 91→90 (predicted) → **92→91**; sign
ids moved ~5 (predicted) → **2**; broken citations 37 cumulative / 22 hand-read
(predicted) → **23, all hand-read, 0 dropped**; whole-line-omission review queue
≤3 (the tightened ceiling) → **1** (`Ch. 5-p007a`, the predicted tilt artefact).
Predictions were again unreliable, though closer than Stages 1–2 once the
geometry bug was fixed.

**Independently audited from scratch, adversarially, against the no-loss claim** —
all 188 pages, source page images cropped at 3–4× for the ambiguous cases. The
diff reconciled exactly: 81 changed pages, 72 removed / 123 added lines, budget
+51 lines / +300 chars both ways. Of the 72 removed lines: 55 plainly contained, 2
contained modulo punctuation, **15 not contained** (auditor's split differs from
the implementer's 55/11/6 but totals identically at 17) — every one of the 15
checked individually and found to be either a garbled multi-line smear fully
covered by a surviving clean line (e.g. `'wet stas has the purpose stone purpose of
the'` conf 0.50 → the clean `'other things has the purpose of storing energy…'`
conf 1.00), or OCR noise hallucinated off graphics (`'Sas'` on a dashed lane-line
diagram, `'L19'` on a sign pictogram, `'4'` on `Ch. 1–2-p005a` a faint mark in the
binding gutter with no textual survivor at all). **No removed line carries a word,
number, negation or clause absent from its page's surviving text.** The x-gate was
verified to have eaten no distinct repeated caption.

Deck: **776 → 775** — 247 authored MCQ, **6 cloze** (was 5), **522 sign** (was
524). The 2 sign cards are the orphaned id below. Cloze 5 → 6: all prior facts
preserved under shifted per-chunk indices, plus one legitimately new "2 years" fact
from the newly-merged `ch-1-2:5a:q52h9l` — not a defect.

**Sign ids — 2 moved, `--update-ids` run deliberately after confirming both by
hand.** `umferdarmerki-enska:5full:qkl7e4` orphaned (successor label garbled,
auto-excluded by `CLEAN_LABEL`, no card ships under it — study history lost,
nothing misattributed). `…:6full:1ksslu7` → `1pbomoc` ("Sports" → "Sports centre",
same sign, better label, shipped). Orphaning was accepted; misattribution would not
have been.

**Suites, independently re-verified:** `test:e2e` 197/197, `cards --strict` exit 0
(775 cards), `typecheck` clean, `test:app` 97/97 on first run. No floor, threshold
or constant was lowered anywhere across all three stages.

No number was lost in any of the original five omission instances.

*Files:* `build/tools/bookocr.swift` (`OCR_PAD`, `mergeTwo`, `dedupContained`,
recompiled), `pipeline/src/layout.ts` for the general detector.
*Done when:* ~~ch-6 p.101 and ch-6 p.115 carry their full text, and the other three
are either restored or recorded as gaps~~ — **done**. ch-6 p.101 and p.115 both
carry their full text; see the audit above for the remaining 15-of-72 removed
lines, none of which is book prose or cited.

### C10 · S2 · ✅ DONE · Make the omission detector a permanent check
The probe built one that works, calibrated on the known instance: a wrapped line is
short only because the next word did not fit, so `ratio = shortfall / width(next
line's first word)`. The ch-6 p.115 instance scores **4.41, rank 1 of 1,336**,
against p99 = 0.62 — and the estimate of 26.5 dropped characters matched the 27
actually missing. Verified precision at `ratio ≥ 2.0` is **2 of 2**, with the highest
verified false positive at 1.14 and the lowest true positive at 4.11, so the gap
around 2.0 is wide.

A second signal — a double-leading "pitch hole" that catches whole lines Vision
never observed at all — runs 5 of 8, with 1.64 true against 1.62 false. **That one
must stay a review queue, not an assertion**; the classes overlap and it would flap.

**Landed 2026-08-05 as `omissionScan()` in `e2e.ts` (signal 1 as a floor)**, and
closed out 2026-08-06: the detector's own regression signal, `TAIL_OMISSION_ALLOWLIST`,
was silently only `console.log`ged if it went stale — now
`check('tail-omission allowlist has no stale entries', om.staleAllowlist.length === 0)`
asserts it. Suite 196 → 197.
*Files:* `pipeline/src/e2e.ts` (signal 1 as a floor, now with the stale-allowlist
assertion), plus a reviewer list for signal 2 (still a review queue, not an assertion).

### C11 · S2 · ✅ DONE — STAGES 1–3 LANDED · Probable root cause of the omissions, in `bookocr.swift`
`better()` prefers only *suffix* supersets, which is the rule that repairs Vision's
clipped leading glyph (`course` → `ourse`). A **prefix** superset — one framing reads
the whole line, the other truncates the tail — falls through to the confidence
tiebreak, where the padded pass wins unconditionally at equal confidence. That is
exactly the shape of the observed failures.

**Confirmed and fixed 2026-08-06 (Stage 1).** `better()` gained symmetric
prefix-superset handling, gated on an alphanumeric tail (`hasAlnum`) — an ungated
variant and a bare tail-length threshold were both measured and rejected first. Full
re-OCR + rebuild, verified against a byte-identical control run of the unedited path
before touching anything. 36 pages changed (predicted 36); +404 net chars against a
predicted +396, an 8-char divergence, flagged and left unexplained; all 9 broken
citations re-pointed, 0 dropped.

**The hypothesis is confirmed for the general prefix-superset case but does not reach
ch-6 p.101** — that line was already established (in the original probe) to appear in
*neither* OCR framing, so no `better()` rule, gated or not, recovers it. That page still
needs Stage 3 (`OCR_PAD` + containment dedup).

**Stage 2 landed and is green, with a measured extension the plan did not contain.**
The plan's literal Stage 2 — best-first 1:1 pairing on separate y/x dominance
(`Y_MIN 0.60`, `X_MIN 0.50`), replacing `overlaps()` — was implemented, and **every
predicted number diverged**: 18 pages changed vs a predicted 65, −64 net chars vs +587,
chunks 1,944 → 1,936 vs a predicted → 1,930, 0 sign ids moved vs a predicted 3, 3 broken
citations vs a predicted 12, duplicate pairs 42 → 39 vs a predicted → 38. Recorded as
unexplained-but-real, not rationalised — treat the plan's Stage 2 (and by extension
Stage 3) effect-size predictions as estimates, not acceptance criteria.

**Why: a structural gap in the plan's 1:1 model — one-to-many fragment collisions.** On
`Ch. 1–2-p007b` one OCR pass read "the administration's information- and service line"
as ONE box; the other split it into THREE. All three clear the gate; a MIDDLE fragment
won the greedy claim, failed `better()`'s prefix/suffix test, won the confidence
tie-break, and destroyed the fused reading while locking out the two fragments that
would have restored it. The plan's pairing model has no slot for this shape at all.

**The extension, measured first, not designed on intuition.** Corpus-wide: 662 fan-out
collisions (fan-out 2/3/4+ = 548/110/4). For each, the x-order single-space
concatenation of the fragments was compared against the one-box reading,
whitespace-collapsed: **exact match in 51 cases, whitespace-only-modulo match in 0,
no match in 611.** All 51 were read by hand and are genuine same-line splits; the 611
include marginal headings colliding with body lines and never coincide with the one-box
reading. Exact-join is therefore a clean discriminator with no observed false-positive
path. **The rule:** for a box with ≥2 gate-passing candidates, join the candidates in
x-order and compare whitespace-collapsed against the one-box reading; on exact match
claim all fragments and keep the fused reading; everything else falls through to the 1:1
path unchanged. `better()`'s Stage-1 alnum gate is untouched.

**Post-extension measured state**, against the pre-Stage-2 baseline: 53/188 pages
changed, net −721 chars, lines 9,351 → 9,290, chunks 1,944 → 1,907, sections 91 → 92,
sign ids 357 match / **0 moved**, duplicate pairs 42 → 38. 11 citations re-pointed, each
confirmed by reading the successor chunk, none dropped (files touched: ch-4-b, ch-4-c,
ch-5-b, ch-6-b, ch-7-a).

**An independent adversarial audit of the "no text lost" claim** classified all 72
removed line-instances: **68 redundant** (contained verbatim in a surviving line),
**1 borderline punctuation-only** (a stray `• 97`, correctly dropped), and **3 not
contained**. The character budget reconciles exactly: 1,069 removed − 348 added = 721;
72 − 11 = 61 net lines. The 3:
1. `'84 DRIVINGINICELAND'` (Ch. 5-p005a) — false alarm. The baseline glued two page
   elements with no space; the change correctly splits them into `'84'` +
   `'DRIVING IN ICELAND'`. An improvement, not a loss.
2. `'Mosfelisbaer'` (Appendix-p006b, conf 0.30) — one of ~5 garbled misreadings of
   "Mosfellsbær" on one sign-legend figure; same lexical content, a distinct physical
   instance.
3. `'or sit people heart'` (Ch. 7-p002b, conf 0.50) — nonsense between two intact prose
   lines, genuinely gone. **Proven not caused by the fusion extension** — an isolated
   old-vs-new merge simulation on that page gives identical output with and without the
   new rule. It is an artifact of Stage 2's own best-first tie-break, a second and
   separate mechanism (see Traps in `HANDOVER.md`).

Honest framing: **the zero-loss claim holds for 69 of 72 removed lines, not all 72.** No
lost line is book prose and none is cited, but the third case above is a real,
unresolved loss, just not one this extension caused.

**New artifacts, harmless, recorded not fixed:** a spurious duplicate line on
Ch. 7-p002b and a duplicate `DRIVING IN ICELAND` header on Ch. 5-p011b. Also: `'84'` on
Ch. 5-p005a carries alts `["8","4"]` — produced by the fusion rule gluing two real
adjacent digit detections, so it is technically assembled rather than a single verbatim
read. Within the rule's design, worth knowing, not a defect.

**Suites, independently re-verified:** `test:e2e` 197/197, `cards -- --strict` exit 0
(776 cards — 247 MCQ / 5 cloze / 524 sign), `typecheck` clean, `test:app` 97/97. No
floor, threshold or constant was adjusted anywhere in this pass.

**Stage 3 (`OCR_PAD` + containment dedup) landed 2026-08-06 — see C6 above for the
full account**, including the real-text-deletion bug found in the plan's own
containment rule and fixed before shipping (the `X_MIN = 0.50` x-gate). Stage 2's
predicted effect sizes diverged from Stage 3's actuals just as much as they
diverged from Stage 2's own — the lesson holds across all three stages: treat this
plan's predicted numbers as estimates, never as acceptance criteria. Final state:
`test:e2e` 197/197, `cards --strict` exit 0 (775 cards), `typecheck` clean,
`test:app` 97/97, no floor lowered across any stage. **C6/C10/C11 are closed.**
*Files:* `build/tools/bookocr.swift` (recompiled: `swiftc -O bookocr.swift -o
bookocr`). **`npm run ocr` wipes `build/work`, so `npm run figures` must follow it.**

### What the probe closes off — do not attempt these
- **There are no word boxes anywhere.** All 9,351 lines carry only `text, conf, x, y,
  w, h, alts`; `bookocr.swift` never calls `boundingBox(for:)`. The inter-word-gap
  test I originally proposed **cannot be run** on existing data.
- **Glyph height is not a usable normaliser.** Within a single column,
  `max(h)/min(h)` is 1.87 median and 3.33 max, so any h-scaled threshold is noise.
  This also kills the "line box wider than its text" signal: 1,901 hits whose top
  entries are complete, undamaged sentences. Chars-per-width per column is stable to
  5.8% and is what the working detector uses instead.
- A figure-overlap filter suppressed a true positive, because crop boxes carry
  generous margins. Do not filter candidates by figure overlap.

### C7 · S3 · Text callout boxes published as pictures
From `HANDOVER.md`: ch-6's brake and life-insurance boxes and two in ch-7 are
published as illustrations, and their text then repeats verbatim in the prose
below.
*Files:* `pipeline/src/layout.ts`.

### C8 · ✅ DONE · ch-1-2 table of contents block is not recognised
From `HANDOVER.md`: the `.toc` styling exists but the block is never matched on that
page, so page numbers glue to the wrong entries. Fix alongside C1 — same page, same
recogniser, and C1's off-by-one is the more serious half.
*Files:* `pipeline/src/layout.ts`.

### C9 · S3 · Signs detected only by their caption
From `HANDOVER.md`: five road markings on p010 and several route/direction signs on
p005 have their captions cropped but not their graphics, so they are absent from
both the site and the deck. Absent beats wrong, and they are recoverable — the
detector is finding the label and missing the picture above it. Recovering these
also feeds B11, since p010's road markings are exactly the starved section.
*Files:* `pipeline/src/layout.ts`.

### C12 · ✅ DONE · S1 · Published FALSE: an automatic-towing rule widened to all towing
Book p.96 published "Cars that have transmissions should only be towed…", dropping
"automatic". Cited by `ch-6-a-03`, whose card was correctly worded from the fact —
only the edition was wrong. Cause: the towing callout box was mis-detected as a
photo region, and `pageBody()`'s `insidePicture()` guard drops lines that are both
≤14 chars and inside a figure's core bounds; every other callout line was longer
and survived, so only the 9-character "automatic" was swallowed. Not an OCR defect
— Vision read it at conf 1.0; the omission is purely `insidePicture`'s.

**Fix:** `rawInsidePicture` + a new `isSandwichedProse()` in `pipeline/src/layout.ts`.
Measured: of 548 lines `insidePicture` drops corpus-wide, 34 have surviving
same-column prose neighbours above **and** below (Δx<0.03, Δy<0.03); 33 are
unambiguous sentence completions, the 34th a licence-specimen fragment at conf
0.30, excluded by a `conf >= 0.4` floor. Confirmed present identically in all three
archived pre-OCR-sweep baselines — not a regression from C6/C10/C11.

Blast radius: 7 other pages' paragraphs correctly merged; 5 citations re-pointed and
repaired, each confirmed by reading the successor chunk: `ch-1-2-a-07`, `ch-4-b-06`,
`ch-4-c-08`, `ch-5-b-08`, `ch-6-a-03`. Collateral, recorded not fixed: on
`Ch. 5-p007b` restoring two rescued words shifted that column's statistics and
fragmented a nearby paragraph further — pre-existing C5 `paragraphize` fragility,
triggered, not introduced.
*Files:* `pipeline/src/layout.ts`.

### B13 · ✅ DONE · S1 · Five sign crops shipped the wrong image for their label, found by opening them
Not caught by any check — a mismatch between crop and label is invisible to
`cards.ts --strict`, which only validates shape. Found by opening all 121 sign
images visually: `10full:xa3ofy` (illegible photographic noise), `8full:5ucr98-2`
(five black dots, no person icon, shipped as "Caution - blind people"),
`4full:v2px8m`/`bgtx5p-2` (lorry turning-space pair with left/right labels
**swapped**), `3full:1puizi3-2` (lane-group heading on a direction arrow),
`4full:bgtx5p` (catalogue only). All excluded, 10 cards lost.

**Diagnostic pattern:** in 3 of 5, one sibling on the same sheet row was already
excluded and an identical-defect sibling had been missed. A sibling sweep is
required whenever one sign on a row is found bad — the full sweep here (121 images,
plus 8 directional pairs pixel-diffed: true mirrors diff 4–17, cross-pairings 30+)
found no further mismatches.
*Files:* `pipeline/cards/sign-exclusions.json`.

### B14 · ✅ DONE · S3 · Over-exclusion in the other direction: `"Give-Way line`
Excluded as `GARBLED_LABEL` for a stray quote, with its `reason` field merely
describing the image rather than justifying the exclusion, and nothing else in the
deck covering give-way lines. Read at 6×, the page prints `"Give-Way" line` — quotes
on both sides; OCR dropped the closing one. **Recovered** as `Give-Way line` (+2
cards, 765→767). Fidelity tradeoff recorded honestly: `CLEAN_LABEL`'s charset
excludes `"` project-wide (measured and rejected in an earlier session — see
`HANDOVER.md`), so the shipped label is not verbatim, diverging from the
`Bus-stop` precedent (printed hyphen kept). Verbatim was unreachable here.

Two related refusals, each with a real justification, are recorded in
`HANDOVER.md` "Known imperfections": `Unbroken dividing ine` (confirmed reading,
kept out as a visual mutual-distractor with in-deck `p010full-s002`, retyped
`AMBIGUOUS_PAIR`) and `Orgamized street running` (the book's own typo, retyped
`SOURCE_TYPO`, kept out because a non-word as sole correct answer reads as an app
bug). Also: 10 exclusion `reason` fields rewritten to justify rather than describe,
2 `GARBLED_LABEL`→`WRONG_LABEL`, 1 →`BAD_CROP`, 2 truncated reason strings repaired.

**A landmine defused:** `sign-label-corrections.json`'s RECOVERY note for
`p003full-s017` told a future maintainer to delete that sign's exclusion — the exact
sign re-excluded in B13. Now prefixed "SUPERSEDED 2026-08-06 — DO NOT ACT ON THE
RECOVERY BELOW" with the reasoning; original note kept; the two sign files
deliberately disagree, same convention as `p010full-s007`.
*Files:* `pipeline/cards/sign-exclusions.json`, `sign-label-corrections.json`.

### B16 · ✅ DONE · `ch-7-a-21` cited an existing chunk that was the wrong one
Fixed 2026-08-06. It cited a table-header fragment (`"#The following are examples
of penalty points. 3 Penalty"`, missing even the word "points"). Re-pointed to
`ch-7:6a:1i6tc4p` (kind `list`, conf 0.5), which states the 26 km/h-over-a-30-limit
condition verbatim and also backs the card's explanation. Structural point worth
keeping: `cards --strict` only fails when a cited chunk *vanishes* — a card citing
an existing-but-wrong chunk is invisible to it, unlike the citation-repair work in
C12 above where the chunk had actually disappeared. **Trap:** an earlier report of
this project cited the successor as `ch-7:6a:1v9m2dq` — that id does not exist in
`dataset.json`, a hallucination. An id quoted in a report is not evidence the id
exists; verify against the dataset before trusting it.
*Files:* `pipeline/cards/ch-7-a.json`.

### B17 · ✅ DONE · `ch-6-b-05`'s explanation no longer borrows from an uncited neighbour
Fixed 2026-08-06. `cards.ts` defines `source: string` — a single citation, no
array — so citing both chunks was never possible. The explanation's second clause
(the 10,000 ISK passenger fine) came from uncited `ch-6:8b:kd8eja` and was removed;
the replacement stays within the cited `ch-6:8a:pup93c`.
*Files:* `pipeline/cards/ch-6-b.json`.

### B18 · ✅ DONE · Duplicate pair `ch-1-2-a-11` / `ch-5-a-17` — resolved, `ch-5-a-17` RETIRED
Fixed 2026-08-06. Both cited independent passages stating the identical
category-B trailer rule. `ch-5-a-17` was retired rather than `ch-1-2-a-11`:
beyond the duplication, its explanation asserted "the trailer may never exceed the
figure in the car's registration", which its cited chunk does not support. Id
recorded in `README.md`'s retired-ids table and must never be reused, joining
`appendix-a-09`, `appendix-a-10`.
*Files:* `pipeline/cards/ch-1-2-a.json`, `ch-5-a.json`, `README.md`.

### B10-correction · sheep, reindeer, crosswind — the record was wrong about "crosswind"
B10 above lists "sheep", "reindeer" and "crosswind" as zero-coverage gaps. Re-checked
this session: **"crosswind" is a BOOK gap, not a deck gap** — the word appears
nowhere in the source, so no card can cite it. Sheep and reindeer remain genuine
zero-card gaps; the sheep passage sits in `ch-4:17b:10uptcl`, a chunk already cited
twice for other facts and ready to author against.

**✅ DONE, 2026-08-06 — sheep and reindeer closed.** `animals` topic went from 1
card to 4. New: `ch-4-c-21` (which loose-sheep situation the book calls most
dangerous — the ewe/lamb split; rewritten after review to test the stated fact
rather than an inferred reason), `ch-4-c-22` (duty to try to contact the owner
after hitting a farm animal — `ch-4:17b:vxwk3p` is truncated mid-sentence, so only
the legible "try to contact the owner" clause was used and the "report to whom"
fact was deliberately skipped), `appendix-a-23` (the reindeer warning sign).
"Crosswind" remains a book gap, unclosable.
*Files:* `pipeline/cards/ch-4-c.json`, `appendix-a.json`.

### C13 · S2 · Missing figure on ch-6 p.106 — whole diagram absent
Captions survive as orphaned text; the diagram itself is not in the edition.
Consequence for a known imperfection: p.106's reversed tread labels (`Worn Tread` /
`New Tread`, `Unstudded` / `Studded`, see `HANDOVER.md` "Known imperfections") cannot
assert anything backwards *because* the diagram that would label them is absent.
(Its captions now publish per C14's overrides list, below — the diagram is still
missing.) The 4 figures known to have vanished during the OCR stages were never
identified (no pre-session `figures.json` baseline exists, and the oldest surviving
one predates a filename convention change) and were not re-investigated this
session.

**Two corrections to this entry, measured 2026-08-06 — do not re-cite the old
claims:**
- **ch-6 p.98's figure was never missing.** Figure 6.2 is present with all eight
  labels baked in as pixels. What is actually missing is the OCR *text* of the
  right-hand labels (Air Filter, Fuse box, Battery) — a separate, pre-existing OCR
  gap, likely mis-oriented/curved text. Recorded, not fixed. **Struck from this
  entry's title and scope.**
- **ch-6 p.111 was not a missing-figure case at all — it was the figure-cropper
  merge bug.** See C15: figures 6.16/6.17/6.18 were bridged into one blob by a
  bleed-through-ink sliver, not absent from the source. Fixed, and struck from
  this entry.
- **The "43 `ok`-graded `figures.json` entries with no file in `site/figures/`" was
  not a defect.** 203 unfiled manifest entries = 119 (Appendix 78 +
  `umferdarmerki_enska` 41, which read imagery from `signManifest` by design —
  verified in `build-html.ts`, not assumed) + 84, and all 84 are caught by the
  existing `isRule()` page-furniture filter. Replicating that test independently
  matched **43 of 43**. Struck from this entry.
*Files:* `pipeline/src/layout.ts`, `build/tools/*.swift` figure cropping.

### C14 · S2 · `checkcrops.swift` misgrades line art as text-only — systemic, worked around, not fixed
Its "many small blobs, no dominant shape, no colour → caption" rule is tuned for
signs and misfires on diagrams made of thin disconnected strokes. Auditing ~20
text-only crops found a jump-start diagram, a clutch mechanism, CPR panels, a
child-distraction illustration and road-sign chevrons all being silently dropped.

No univariate geometric threshold separated the ~3 genuine caption fragments from
the misjudged diagrams, so a corpus-wide retune was **rejected as unverifiable
within budget** (precedent: two earlier guesses regressed the build — see
"Measured and rejected" in `HANDOVER.md`).

**Workaround shipped:** a new `pipeline/figure-grade-overrides.json`, a
hand-reviewed exception list of 12 crops each opened and confirmed against the
scan, consumed by both `build-html.ts` and `e2e.ts` — the "no text-only crop
published" check was updated in lockstep so it stays meaningful rather than being
weakened. ch-6 p.106's figures 6.10/6.11 now publish.

**The underlying weakness is open: an unknown number of misgraded crops remain
beyond the 12 verified.** Do not close this until the geometric rule itself is
fixed or replaced.
*Files:* `build/tools/checkcrops.swift`, `pipeline/figure-grade-overrides.json`,
`pipeline/src/build-html.ts`, `pipeline/src/e2e.ts`.

### C15 · ✅ DONE · S1 · Figure cropper merge bug — bleed-through ink bridged figures into one blob, 34 figures recovered
`build/tools/figures.swift`'s merge loop is transitive and filters by size only
**after** merging. On ch-6 p.111 a 53×537px sliver of bleed-through ink from the
facing page hugged the left margin and bridged figures 6.16/6.17 to 6.18 plus all
intervening body text into one page-spanning blob carrying 6.18's caption.

Diagnosed by reimplementing the ink-mask/dilate/connected-components/merge
algorithm in Python to inspect pre-merge regions. Swept 47 pages plus all 24 ch-6
pages for the signature (edge-touching, aspect ≥ 3, width < 15%·W): exactly 3
slivers, all confirmed bleed/shadow, none real content.

**Fix:** drop such regions before the merge loop runs, not after — measurement
recorded in-comment beside the rule. Manifest 377 → 411.
*Files:* `build/tools/figures.swift` (recompile: `swiftc -O figures.swift -o
figures`, then `npm run figures`).
*Check:* ch-6 p.111's figures 6.16–6.18 crop separately; the 3-sliver signature
sweep matches 3 of 3.

### A14 · ✅ DONE · S1 · The "one direction per sign per session" promise was broken
`viewSigns()`'s per-category buttons called `Engine.shuffled(list).slice(0,20)` and
bypassed `oneDirectionPerSign` entirely; only the "Mixed signs" entry point honoured
it, so both directions of a sign were routinely served in one sitting. Found by
driving the app in a real browser, not by any of the 97 prior checks.
*Files:* `app/js/ui.js`.
*Check:* new regression test, confirmed to fail against the pre-fix code.

### A15 · ✅ DONE · S2 · "Seen" tile over-reported
Now `Engine.seenCount(cards, sched)` counts only ids in the live deck; nothing is
deleted from storage since a retired card can return.
*Files:* `app/js/engine.js`, `app/js/ui.js`.
*Check:* new regression test, confirmed to fail against the pre-fix code. `test:app`
97 → 99.

**A third reported app bug — distractors not drawn from a sign's own category — was
measured and refuted, not fixed:** 99.48% of distractor slots are already
same-category across 1,536 slots; the only leakage is "Police hand signals" (2
signs, cannot fill 3 distractors). The symptom actually observed was repetition
*within* a category. Recorded as refuted so it is not re-"fixed".

### A16 · ✅ DONE · S4 · Design pass — reading typography, contrast, a due chip, a sign lightbox
Merriweather self-hosted (400/700/italic, ~304KB static files — the variable
family's name table reports every instance as "Light 18pt", so static was the
correct choice), paired with the existing system stack for chrome: read vs
operated. Measured contrast: dark 14.42:1 body, light 13.99:1, tightest pair 4.61:1
(above the 4.5:1 AA floor), accent 9.67:1. Added an Icelandic-hazard-sign due chip
and a lightbox for sign images (road-marking diagrams were illegible at card size).
Fonts wired through `pipeline/src/build-html.ts` → `pipeline/assets/fonts/` so they
survive a rebuild. Four briefed problems (sign-grid reflow, tabular numerals,
keyboard access, reduced-motion) were found already solved and verified, not fixed.
One flex bug caught after shipping: `.duechip`'s `gap` did not apply between two
adjacent bare text nodes, which collapse into a single anonymous flex item — the
glyph now has its own element.
*Files:* `app/css/style.css`, `app/index.html`, `pipeline/assets/fonts/`,
`pipeline/src/build-html.ts`.

## What the scan sample confirms is sound

Worth recording so the sweep does not go looking for problems that are not there:

- **Zero orientation or page-split failures** across all 24 sampled pages. The
  majority-vote orientation logic and fold detection are holding.
- **Every number that could be read matches the scan.** The one wrong emergency
  number — `1 -2 – 2` on ch-8 p.141 — is **the book's own typo, faithfully
  reproduced**. Do not "fix" it; if anything it wants an editorial note.
- The prohibition-sign deck is **24 of 24 correct**.
- The deck draws signs only from the sign sheet, so the appendix's 65%-unlabelled
  pictures and its four caption-blob pages **cannot reach a card**. They are a
  reading-edition problem only, which is why they sit below everything above.

---

## Sequencing for the sweep

1. ✅ ~~**A8–A11 first, before anything else.**~~ **Done**, along with A6, A7 and
   A13 — the whole of the app track except A12, which is upstream. `store.js` now
   has `sanitize()` + `version: 1` + `migrate()` + a merging `flush()` with a
   `storage` listener.
2. ✅ ~~**A1–A5.**~~ **Done.** `test:app` still 94 green, typecheck clean.

   **Section A is therefore complete except A12.** Two follow-ups the agents flagged
   rather than silently absorbing, both worth doing when `e2e-app.ts` is next open:
   the block of regression checks for A6–A13 was written up but **not added**, since
   the file was owned elsewhere and the count had to stay at 94; and A7's `site/`
   probe unavoidably logs one 404 when `site/` is absent, so `test:app` now assumes
   `site/` has been built.
3. ✅ ~~**A12 with B1.**~~ **Done.** Rebuilt together as planned — one id migration,
   not two.
4. ✅ ~~**C1, C2, C3 before C5.**~~ **Done.** All three S1 text defects fixed and
   verified; C3's Red Cross sequence renumbers correctly.
5. ✅ ~~**C5, the column interleaving.**~~ **Done, with four residuals** (`C5-r1`
   through `C5-r4`, recorded under C5 above — none is a fresh defect, all are
   documented limits of the shipped `frameCut`/`CROSS_MAX` approach).

6. ✅ ~~**C6/C10/C11, the silent OCR omission.**~~ **Done, all three stages.** Stage 3
   landed 2026-08-06 and restored ch-6 p.101's inverted safety instruction — the
   last item in the project that could teach something false. See C6/C11 above for
   the full account, including a real-text-deletion bug found and fixed in the
   plan's own containment rule before shipping.

7. ✅ **A validation pass — first real use of the product.** Driven in a real
   browser, 121 sign images opened, ch-6 read against the scans, 54 authored
   questions reviewed. Found and fixed a published FALSE (C12), five wrong sign
   images and one over-exclusion (B13/B14), and two app bugs (A14/A15) — none
   visible to the 197+97 checks that stayed green throughout. New open items at
   the time: B16–B18, C13. See `HANDOVER.md` for the full account.
8. ✅ **A final fix round.** B16, B17 and B18 all fixed; a real figure-cropper
   merge bug found and fixed (C15, ch-6 p.111); a full 247-card citation sweep run
   (B8, 0 unsupported, 13 tolerated-fragmented, `ch-7-a-21` was the one real
   defect); the animal-hazard gap closed (B10-correction, sheep + reindeer); and
   two of the previous round's own findings (ch-6 p.98's figure, the 43 orphaned
   `figures.json` entries) were re-checked and found wrong — see C13 for the
   correction. `checkcrops.swift`'s line-art misgrading (C14) was found but only
   worked around, not fixed.

What is actually left, ranked:

1. **C4/C7/C9 — the small ones**, roughly an hour together. C4: wrong and
   unanswerable sign cards from sign sheet p005/p010. C9: signs detected only by
   their caption. C7: text callout boxes published as pictures.
2. **B1-r1** — the crop colour-coverage gate does not separate cleanly everywhere;
   two measured counter-examples (`p005full-s006`, `p008full-s062`) are named in the
   entry, and seven of B12's corrections exist only to strip an on-face legend, which
   is the symptom.
3. **B10/B11 — authoring, still unbounded but smaller.** 59 of the 62 targets
   remain (3 animal cards shipped this round). "Sheep" and "reindeer" are no
   longer at zero; "crosswind" stays a book gap, unclosable.
4. **The four C5 residuals** (`C5-r1`–`C5-r4`), each with its own *Done when* under
   the C5 entry above — `CROSS_MAX` on appendix p.165 chief among them.
5. **C14** — `checkcrops.swift`'s line-art misgrading, worked around with a
   12-entry hand-reviewed exception list, not fixed at the mechanism. An unknown
   number of misgraded crops remain beyond the 12 verified.
6. **C13** — ch-6 p.106's diagram is still absent (only its captions now publish).
   ch-6 p.98's right-margin OCR text gap (a distinct, smaller defect) is unfixed.
   The 4 figures that vanished during the OCR stages remain unidentified.
7. **The 13 B8-class fragmented citations** (listed under B8 above) — tolerated,
   not defects, but still imprecise.
8. **The publishable `public/` tree** does not exist yet, and nothing in this
   project has ever been committed or pushed — see `HANDOVER.md` "Publishing".
   GitHub Pages deployments are also currently failing server-side
   (`deployment_in_progress` → timeout), independent of repo readiness.

**B2, B3/B4/B5, and B16–B18, once things worth pulling ahead of this order, have
all shipped** (see their entries above) — nothing here still depends on doing
them first.

## The five things that matter most, if the sweep gets cut short

1. **C3** — the 4-step Red Cross procedure on ch-8 p.141 is renumbered.
2. **A8–A11** — four ways the app destroys study history, one of them the ordinary
   two-tabs case.
3. **C2 and C6** — the two places the edition taught the *inverse* of the source:
   ch-4 p.74's stopping rule, and ch-6 p.101's battery instruction, where a dropped
   line had turned "avoid having our head above the battery" into "we must be above
   the battery". **Both are now fixed** — C6's fix (Stage 3, above) closed the last
   item in the project that could teach something false.
4. **B2** — the sign pair with two correct answers.
5. **C1** — every page number in the contents is off by one.

Everything else degrades the experience or leaves a gap. These five are wrong.

## Recommended follow-up validation

Asked and answered during this pass: a **broader OCR accuracy audit is not worth
running**. Nothing found was a misrecognised word causing harm — accuracy is already
measured at 96.6–99.4%, every readable number in the 24-page sample matched the
scan, 44 of 44 citations read correctly, and two prior audits found zero wrong
answers. The defects were structural, and they all live in `layout.ts`. The project
has also already measured and rejected auto-correction. Three narrow probes are
worth it instead, each aimed at something the existing safeguards structurally
cannot see:

1. ~~**Validate all ~350 sign labels exhaustively.**~~ **Done** — `sign-labels.md`,
   all 357 signs, one table row each. Result: 84.8% of in-deck labels exactly right,
   16 wrong (re-measured at B12 time as 17, and all 17 since corrected — see B12), 0
   showing one sign under another sign's name. See B2, B7, B12. It was worth doing:
   it corrected my prescription for B2 and revealed that B7's filter does not work
   at all.
2. ~~**Probe for dropped words.**~~ **Done** — see C6, C10, C11. Answer: ~2.2% of
   pages, ~5 instances corpus-wide, one of which inverts a safety instruction. The
   gap-between-word-boxes test I proposed turned out to be impossible (no word boxes
   exist); a chars-per-width shortfall test works instead and is calibrated.
3. **Turn the structural defects into corpus-wide checks, not another reading pass.**
   This is the real gap — 11 of 24 sampled pages were broken, but the sample was
   biased toward suspects, so we do not know which of the 188 pages carry each
   defect. `<ol>` numbering continuity (C3), TOC entries against actual folios (C1),
   bullets ending in a colon that swallowed a heading (C2) and `<figcaption>`
   word-count outliers (C5, where 172 words flagged ch-4 p.66) are all machine
   checkable. Make them e2e floors so the defects cannot come back.
