# Authoring contract — multiple-choice questions

One file per work packet, named `<packet-id>.json`. Packets live in
`build/work/packets/`; `npm run cards` validates every file here against the
dataset and merges the survivors into `app/data/cards.json`.

## File shape

```json
{
  "packet": "ch-4-b",
  "questions": [
    {
      "id": "ch-4-b-01",
      "question": "On a road with a 90 km/h limit, when may you exceed it?",
      "options": ["Never", "When overtaking", "On a motorway", "In light traffic"],
      "answer": 0,
      "explanation": "The limit is absolute; overtaking is not an exemption.",
      "topic": "speed",
      "source": "ch-4:12a:37"
    }
  ]
}
```

## Rules the validator enforces

A question that breaks any of these is rejected and never reaches the app.

| Field | Rule |
| --- | --- |
| `id` | Unique across all packets. Use `<packet-id>-NN`. **Never reuse a retired id** — see below. |
| `question` | ≥ 15 characters. Must not duplicate another question. |
| `options` | Exactly 4, all non-empty and distinct. No "All of the above" / "None of the above" / "Both A and B" — the app reshuffles options, so positional text breaks. |
| `answer` | Integer 0–3, indexing `options`. |
| `explanation` | ≥ 20 characters. Say *why*, do not restate the option. |
| `topic` | One of the topic ids below. |
| `source` | A chunk id that exists in the dataset **and belongs to this packet's document**. Copy it from the packet file. |

## A retired id is never reused

Card ids are the key the app's SM-2 scheduler stores study history under. Deleting a
question does **not** delete a student's history for it, so minting a new question
under a retired id silently inherits that card's interval, ease factor and review
log — a brand-new question arrives already "known". The validator only checks that
ids are unique among the questions *currently* authored; it cannot see the ones that
have gone.

So: when a question is removed, its id is spent. Take the next unused number for the
packet and leave the gap. Retired ids so far, both dropped in 2026-08-05's frame fix
because their facts survive only as figure captions and no chunk supports them:

| Retired id | The fact it tested |
| --- | --- |
| `appendix-a-09` | The single-lane paved-surface sign applies at a width of ≤ 5 m. |
| `appendix-a-10` | A supplementary speed plate gives the *recommended* speed, not the legal maximum. |

Both facts are still true and still worth a card. Re-author them under fresh ids
once a chunk carries them — not under these.

## Topic ids

`speed`, `right-of-way`, `signs`, `alcohol`, `overtaking`, `parking`,
`roundabout`, `weather`, `gravel`, `animals`, `lights`, `occupants`,
`documents`, `accidents`, `vulnerable`, `motorway`, `vehicle`, `rules`,
`test`, `behaviour`, `general`

## What makes a good question here

- **Test the rule, not the wording.** The source is OCR of a photographed book,
  so its phrasing is sometimes damaged. Write the question from the *fact*, in
  clean English. Never quote a garbled sentence.
- **Distractors must be plausible.** Each wrong option should be something a
  learner could believe — a neighbouring rule, a common misconception, a
  plausible-but-wrong number. Obviously silly options make the item free.
- **Keep options the same shape.** Similar length and grammatical form, so the
  answer is not detectable from its style alone.
- **One fact per question.** If a passage carries three facts, write three
  questions.
- **Skip what the OCR mangled.** If you cannot tell what the source says, do not
  guess — leave it out. Fewer, correct questions beat more, doubtful ones.
