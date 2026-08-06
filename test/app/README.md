# Driving in Iceland — study app

A single-page revision app for the Icelandic driving-theory test, built from the
transcribed textbook in `../site`. Everything runs client-side; open
`app/index.html` straight from disk, no server and no network.

```bash
npm run cards      # rebuild app/data from the dataset + authored questions
npm run test:app   # 94 checks: card data, SM-2, exam scoring, flows, both themes
open app/index.html
```

## What it does

**Today** — the cards SM-2 says are due, and three ways in: review, practice, mock exam.

**Practice** — samples the pool weighted towards the topics you are currently
getting wrong: `weight = 1 + 3 × recent error rate`, over the last 50 answers in
each topic, with unseen cards nudged up. Feedback is immediate and every card
links back to the page of the book it came from.

**Signs** — 486 picture cards over 243 signs, both directions ("what does this
sign mean?" and "which sign means X?"). Distractors are drawn from the sign's own
section of the official sheet, so the wrong answers look like the right one —
which is what the exam actually tests.

**Mock exam** — 30 questions in 40 minutes, no feedback until you submit, pass at
25. That is the format of the test as administered by Frumherji; the textbook
does not state it, so it is declared in `js/engine.js` rather than derived from
the content. Papers are 40% signs so a mock resembles the exam rather than the
card pool, and selection is unweighted — a mock measures, it does not coach.

**Progress** — accuracy per topic and per chapter, weakest first, with the
sample size beside each bar; topics with fewer than five answers are greyed and
sorted out of the "weakest" ranking, since one lucky answer is not a measurement.
Plus mock history. Export/import moves your progress between browsers.

## Card sources

| Kind | Count | Where it comes from |
| --- | --- | --- |
| Authored MCQ | 252 | Written from the book text, one work packet per chapter section, validated against the dataset |
| Sign cards | 486 | 243 signs × 2 directions, generated from the official sign sheet's image/label pairs |
| Cloze | 7 | Rule-based extraction of the book's number facts |

Authored questions are validated at build time — four distinct options, an answer
index in range, an explanation, a known topic, and a source chunk that really
exists in the document it claims. Anything that fails is reported and dropped
rather than shipped. See `../pipeline/cards/README.md` for the contract.

`../pipeline/cards/sign-exclusions.json` lists signs a review pass judged
unusable (mislabelled, garbled, sliced, or not a sign), with the reason for each,
so they never become cards.

## Design notes

**Dark by default.** The theme is written to `<html data-theme>` before first
paint, so there is no flash, and light is an explicit choice rather than
something inherited from the OS.

**localStorage, not IndexedDB.** A `file://` page has an opaque origin where
IndexedDB is unreliable, and the whole record for a few hundred cards is tens of
kilobytes. Writes go straight through — a debounced save loses the last answer
exactly when someone closes the tab after finishing.

**`data/cards.js`, not `fetch`.** A page opened from disk cannot fetch its own
data, so the card set arrives as a script assigning `window.CARDS`.
`data/cards.json` holds the same content for tooling.

**Options are reshuffled on every presentation**, so repeated review teaches the
answer rather than its position. The stored answer key is also re-ordered at
build time: authors bunch the right answer, and one packet arrived with all
twenty at index 0.

**One direction per sign per session.** "What does this sign mean?" and "Which
sign means X?" share an image and an answer phrase, so asking both in one sitting
makes the second free.

## Known limits

- The pool is thin on a few topics (roundabouts, animals, overtaking) because the
  book gives them little clean prose. The dashboard shows this honestly.
- Only 7 cloze cards: after filtering for OCR damage, the book has few clean,
  self-contained number facts. Most numeric material is covered by authored MCQs
  instead.
- Around 100 signs are not in the deck — clipped crops, group-inherited labels,
  duplicate labels, or review exclusions. Missing beats wrong.
- An in-progress mock exam lives in memory only: a reload abandons it, and the
  answers already given stay in the log. See `HANDOVER.md`.
- The "See it in the book" links point at `../site/`, so they need the repo
  layout; copying `app/` on its own breaks them.
