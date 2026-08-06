/**
 * Card build: authored packets + rule-based cloze + generated sign decks
 * → app/data/cards.json.
 *
 *   npm run cards
 *
 * Everything is validated against the dataset before it ships. An authored
 * question whose source chunk does not exist, or whose options are not four
 * distinct strings, fails the build rather than reaching the app — a study tool
 * that teaches a wrong answer is worse than one with fewer questions.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { extractCloze, type ClozeCard } from './cloze.js';
import { TOPICS, type Dataset, type SignCard as DatasetSign } from './dataset.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, 'build/work');
const SITE = path.join(ROOT, 'site');
const AUTHORED = path.join(ROOT, 'pipeline/cards');
const APP = path.join(ROOT, 'app');

// ─────────────────────────────────────────────────────────────────────────────
// Card shapes

export interface McqCard {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  topic: string;
  doc: string;
  source: string;
  href: string;
}

export interface SignQuizCard {
  id: string;
  type: 'sign-to-meaning' | 'meaning-to-sign';
  /** Image of the correct sign (sign-to-meaning) or of each option (meaning-to-sign). */
  img: string;
  optionImgs?: string[];
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  topic: 'signs';
  category: string;
  doc: string;
  source: string;
  href: string;
}

export type Card = McqCard | ClozeCard | SignQuizCard;

interface AuthoredFile {
  packet: string;
  questions: {
    id: string;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    topic: string;
    source: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic shuffling
//
// The build must be reproducible, so option order comes from a seeded PRNG
// rather than Math.random.

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function shuffle<T>(items: T[], seed: string): T[] {
  const rnd = mulberry32(hash(seed));
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign decks
//
// Distractors are drawn from the sign's own section, because that is what the
// exam tests: telling apart signs that look alike. "No lorries" against "No
// buses" is a real question; against "Camping site" it is free.

/**
 * A usable label starts with a capital or a digit. Every real label on the sheet
 * does; a lower-case opening means the caption was cut and only its tail
 * survived. Measured over all 357 dataset labels with the corrections applied,
 * **6** open lower-case (7 before B12, which repaired "weight limit"): the five
 * give-way-triangle sub-captions "from side roads", "from the right" ×2,
 * "from the left", "from the left Dangerous intersection…", and the truncated
 * "ifficult road. Negotiable only by jeeps…". All six are fragments or
 * sub-captions; none is legitimate. A further 8 fail this class without opening
 * lower-case — 5 empty labels, 2 dashed-frame glyphs ("•- Signs indicating…")
 * and one leading quote — so 14 of 357 are rejected here in total.
 *
 * Length bounds are 4–78 characters. Measured, not guessed: each candidate was
 * run over all 357 dataset labels with the corrections applied, and every label
 * it newly admitted was read off the page band at native resolution before the
 * bound moved. The distribution that decided it:
 *
 *   min length 5 → 4 ({4,·} → {3,·}) — newly admits **exactly 1** of 357:
 *     "Bank" (p006full-s075, Service signs). The p006 caption under the blue
 *     B-and-banknotes plate reads literally "Bank". The corpus holds one
 *     4-character label and it is a real printed caption. Taken.
 *   cap 71 → 78 ({·,70} → {·,77}) — newly admits **exactly 1**: the 77-character
 *     "Half-broken centre line. Overtaking dangerous, only allowed with extreme
 *     care" (p010full-s003, Road markings), read across three printed lines on
 *     the p010 band and identical to the OCR string, so it needs no correction.
 *     Taken. Watch item: its crop (long dashes, short gaps) sits beside in-deck
 *     p010full-s006 "Broken centre line… with care" (short dashes, long gaps) —
 *     the pair is separated by exactly the feature the two captions name, and
 *     stays clear of the e2e-app one-glyph floor (13 edits apart).
 *   cap 78 → 90 — newly admits **6** measured against the rule as it ships below;
 *     all six are the same 89-character group caption "Lane markings showing the
 *     number of lanes on the road, their direction, type and position", five of
 *     them shared/cut, so the de-dup nets **+1** sign (263 → 264). (7 is the count
 *     relative to the *old* {4,70}: the 7th row is `010-003`, taken above. The
 *     82-character "from the left Dangerous intersection…" is not admitted at any
 *     cap — it opens lower-case and the capital class blocks it.)
 *     Rejected — a paragraph is not a card option.
 *   allowing '"' in the charset — admits **exactly 1**, p010full-s024, which is
 *     `cut` and so dropped three lines below anyway. Rejected: buys nothing.
 *
 * No candidate admitted junk; that was the risk and it is not present.
 */
const CLEAN_LABEL = /^[\p{Lu}\p{N}][\p{L}\p{N} ,.'’\-–()/&+%]{3,77}$/u;

/**
 * Signs a review pass judged unusable — mislabelled, garbled, sliced, or not a
 * sign at all. The reviewer's reason is kept alongside so the list can be
 * re-checked rather than trusted forever.
 *
 * Keyed by image path, not by sign id: the crop filename is what the reviewer
 * actually looked at, and it survives the pipeline renumbering its blocks.
 */
function loadExclusions(): Set<string> {
  const file = path.join(AUTHORED, 'sign-exclusions.json');
  if (!existsSync(file)) return new Set();
  return new Set(Object.keys(JSON.parse(readFileSync(file, 'utf8'))));
}

/**
 * Labels a reviewer read off the printed sheet and found the OCR had damaged.
 *
 * Keyed by image path like the exclusions, and for the same reason: the crop is
 * what the reviewer looked at. Each entry carries the reason, so a later pass can
 * re-check the reading instead of inheriting it.
 *
 * This file is the only sanctioned way to change a sign's label. The rule it must
 * respect is the project's: a correction is a *reading of the crop*, never a guess
 * at the OCR. Where the right text cannot be read off the page — `004-017`, where
 * every word is present but the sentence boundary is unreadable — the label stays
 * wrong and the sign is left alone.
 */
function loadLabelCorrections(): Map<string, string> {
  const file = path.join(AUTHORED, 'sign-label-corrections.json');
  if (!existsSync(file)) return new Map();
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { label: string }>;
  return new Map(Object.entries(raw).map(([img, v]) => [img, v.label]));
}

function usableSigns(signs: DatasetSign[], excluded: Set<string>): DatasetSign[] {
  const corrections = loadLabelCorrections();
  const byLabel = new Map<string, DatasetSign>();
  for (const s of signs) {
    if (excluded.has(s.img)) continue;
    // Corrected before every rule below, so a repaired label is subject to the
    // same duplicate-label and CLEAN_LABEL tests as an undamaged one. Applying it
    // later would leave the very duplicate the correction exists to collapse.
    const label = (corrections.get(s.img) ?? s.label).trim();
    // A label the reader cannot act on cannot be a question or an option.
    if (!CLEAN_LABEL.test(label)) continue;
    // A clipped crop may not show the feature the label names.
    if (s.cut) continue;
    // An inherited label describes the group, so several signs share it and
    // neither direction of the question has a single right answer.
    if (s.shared) continue;
    // Duplicate labels within the sheet would make two options both correct.
    const key = label.toLowerCase();
    if (byLabel.has(key)) continue;
    byLabel.set(key, { ...s, label });
  }
  return [...byLabel.values()];
}

function buildSignDeck(signs: DatasetSign[], excluded: Set<string>): SignQuizCard[] {
  const pool = usableSigns(signs, excluded);
  const byCategory = new Map<string, DatasetSign[]>();
  for (const s of pool) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const cards: SignQuizCard[] = [];
  for (const s of pool) {
    const siblings = (byCategory.get(s.category) ?? []).filter((o) => o.id !== s.id);
    // A section with fewer than four signs cannot supply three lookalikes; top
    // up from the rest of the sheet rather than dropping the sign entirely.
    const others = pool.filter((o) => o.id !== s.id && o.category !== s.category);
    const distractors = [
      ...shuffle(siblings, s.id + ':sib').slice(0, 3),
      ...shuffle(others, s.id + ':oth').slice(0, 3),
    ].slice(0, 3);
    if (distractors.length < 3) continue;

    for (const dir of ['sign-to-meaning', 'meaning-to-sign'] as const) {
      const seed = `${s.id}:${dir}`;
      const picked = shuffle([s, ...distractors], seed);
      const answer = picked.findIndex((o) => o.id === s.id);
      cards.push({
        id: `${dir}:${s.id}`,
        type: dir,
        img: s.img,
        optionImgs: dir === 'meaning-to-sign' ? picked.map((o) => o.img) : undefined,
        question: dir === 'sign-to-meaning' ? 'What does this sign mean?' : `Which sign means “${s.label}”?`,
        options: picked.map((o) => o.label),
        answer,
        explanation: `${s.label} — ${s.category}.`,
        topic: 'signs',
        category: s.category,
        doc: s.doc,
        source: s.id,
        href: s.src.href,
      });
    }
  }
  return cards;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation

function validateAuthored(files: AuthoredFile[], ds: Dataset): { cards: McqCard[]; errors: string[] } {
  const errors: string[] = [];
  const chunkById = new Map(ds.chunks.map((c) => [c.id, c]));
  const topicIds = new Set([...TOPICS.map((t) => t.id), 'general']);
  const seenIds = new Set<string>();
  const seenQuestions = new Set<string>();
  const cards: McqCard[] = [];

  for (const f of files) {
    for (const q of f.questions ?? []) {
      const where = `${f.packet}/${q.id}`;
      // Every rule below rejects. It used to only record: `bad()` appended to
      // `errors` and the card shipped anyway unless the check also `continue`d,
      // so 7 of the 11 declared rules — duplicate id, indistinct options,
      // positional option text, short explanation, unknown topic, wrong-document
      // citation, duplicate question — were advisory. 0 of 252 cards violated
      // one, so nothing is lost by enforcing them now; the point is that the
      // next author is checked rather than trusted.
      let ok = true;
      const bad = (msg: string) => { errors.push(`${where}: ${msg}`); ok = false; };

      if (!q.id) { bad('missing id'); continue; }
      if (seenIds.has(q.id)) bad('duplicate id');
      seenIds.add(q.id);

      const chunk = chunkById.get(q.source);
      if (!chunk) { bad(`source chunk not in dataset: ${q.source}`); continue; }
      if (chunk.doc !== f.packet.replace(/-[a-z]$/, '')) bad(`source ${q.source} is not from this packet's document`);

      if (typeof q.question !== 'string' || q.question.trim().length < 15) bad('question too short');
      const norm = (q.question ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenQuestions.has(norm)) bad('duplicate question text');
      seenQuestions.add(norm);

      if (!Array.isArray(q.options) || q.options.length !== 4) { bad('needs exactly 4 options'); continue; }
      if (q.options.some((o) => typeof o !== 'string' || !o.trim())) bad('empty option');
      const lower = q.options.map((o) => String(o).trim().toLowerCase());
      if (new Set(lower).size !== 4) bad('options are not distinct');
      // "All of the above" makes the other options unanswerable in isolation and
      // breaks the shuffle the app applies at presentation time.
      if (lower.some((o) => /all of the above|none of the above|both a and b/.test(o))) bad('positional option text');

      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) { bad('answer must be 0–3'); continue; }
      if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) bad('explanation too short');
      if (!topicIds.has(q.topic)) bad(`unknown topic "${q.topic}"`);

      // Authors bunch the right answer: one packet arrived with all twenty at
      // index 0. The app reshuffles on every presentation, so a learner would
      // never see it, but the stored key would still be a giveaway to anything
      // that reads cards.json directly. Re-order here, seeded by id, so the
      // shipped data is unbiased and the build stays reproducible.
      if (!ok) continue;

      const trimmed = q.options.map((o) => o.trim());
      const order = shuffle(trimmed.map((_, i) => i), `opts:${q.id}`);
      cards.push({
        id: q.id,
        type: 'mcq',
        question: q.question.trim(),
        options: order.map((i) => trimmed[i]!),
        answer: order.indexOf(q.answer),
        explanation: q.explanation.trim(),
        topic: q.topic,
        doc: chunk.doc,
        source: q.source,
        href: chunk.src.href,
      });
    }
  }
  return { cards, errors };
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const strict = process.argv.includes('--strict');
  const ds: Dataset = JSON.parse(readFileSync(path.join(WORK, 'dataset.json'), 'utf8'));

  const files: AuthoredFile[] = existsSync(AUTHORED)
    ? readdirSync(AUTHORED)
        .filter((n) => n.endsWith('.json'))
        .map((n) => JSON.parse(readFileSync(path.join(AUTHORED, n), 'utf8')))
    : [];

  const { cards: mcq, errors } = validateAuthored(files, ds);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) in authored cards:`);
    for (const e of errors.slice(0, 40)) console.error('  ✗ ' + e);
    if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
    if (strict) process.exit(1);
  }

  // What the authored questions already test, per passage, so cloze extraction can
  // decline to ask the same number a second time from the same sentence.
  const askedByChunk = new Map<string, string[]>();
  for (const c of mcq) {
    const list = askedByChunk.get(c.source) ?? [];
    list.push(c.options[c.answer]!);
    askedByChunk.set(c.source, list);
  }
  const cloze = extractCloze(ds.chunks, askedByChunk);
  const excluded = loadExclusions();
  const signCards = buildSignDeck(ds.signs, excluded);
  const all: Card[] = [...mcq, ...cloze, ...signCards];

  // Stage the sign images the deck actually references.
  rmSync(path.join(APP, 'signs'), { recursive: true, force: true });
  mkdirSync(path.join(APP, 'signs'), { recursive: true });
  const needed = new Set<string>();
  for (const c of signCards) {
    needed.add(c.img);
    for (const o of c.optionImgs ?? []) needed.add(o);
  }
  let copied = 0;
  for (const img of needed) {
    const from = path.join(SITE, img);
    if (!existsSync(from)) continue;
    copyFileSync(from, path.join(APP, 'signs', path.basename(img)));
    copied++;
  }
  // Rewrite to the app-local path now that the files live there.
  for (const c of signCards) {
    c.img = `signs/${path.basename(c.img)}`;
    if (c.optionImgs) c.optionImgs = c.optionImgs.map((o) => `signs/${path.basename(o)}`);
  }

  const byTopic: Record<string, number> = {};
  for (const c of all) byTopic[c.topic] = (byTopic[c.topic] ?? 0) + 1;

  mkdirSync(path.join(APP, 'data'), { recursive: true });
  const payload = {
    meta: {
      total: all.length,
      mcq: mcq.length,
      cloze: cloze.length,
      sign: signCards.length,
      byTopic,
      topics: TOPICS.map((t) => ({ id: t.id, label: t.label })).concat([{ id: 'general', label: 'General' }]),
      docs: ds.docs.map((d) => ({ id: d.id, title: d.title })),
    },
    cards: all,
  };
  const json = JSON.stringify(payload);
  // cards.js is what the app loads: a file:// page cannot fetch(), so the data
  // arrives as a plain script assigning a global. cards.json is the same content
  // for tooling that would rather read JSON than strip a prefix.
  writeFileSync(path.join(APP, 'data', 'cards.js'), `window.CARDS = ${json};\n`);
  writeFileSync(path.join(APP, 'data', 'cards.json'), json);

  console.log(`cards.json: ${all.length} cards — ${mcq.length} authored MCQ, ${cloze.length} cloze, ${signCards.length} sign`);
  console.log(`sign images staged: ${copied}; ${excluded.size} sign(s) excluded by review`);
  if (errors.length) console.log(`(${errors.length} authored card(s) rejected)`);
}

main();
