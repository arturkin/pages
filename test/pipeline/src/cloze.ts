/**
 * Rule-based cloze extraction for the book's number facts.
 *
 * These are the facts that convert almost mechanically into cards — speed
 * limits, tread depths, blood-alcohol limits, time periods — so they need no
 * authoring, only careful filtering. The filtering is the whole job: the source
 * is OCR of a photographed book, and a card built from a garbled sentence
 * teaches the garble.
 */

import type { Chunk } from './dataset.js';

export interface ClozeCard {
  id: string;
  type: 'cloze';
  /** Sentence with the fact replaced by "____". */
  text: string;
  answer: string;
  /** Other renderings of the same answer that should be accepted. */
  accept: string[];
  topic: string;
  doc: string;
  source: string;
  href: string;
}

/**
 * A quantity: a full numeric token plus its unit.
 *
 * The number part must swallow group separators as well as decimals — the book
 * writes "3.500 kg" for 3500 and "3,5 m" for 3.5, and matching only the tail
 * would blank "500 kg" out of "3.500 kg" and leave a stray "3." behind.
 * Speed is written both "90 km/h" and "90 km/hour", so the longer unit
 * alternatives have to come first or "km" wins and orphans the "/hour".
 */
const QUANTITY =
  /\b(\d{1,4}(?:[.,]\d{1,3})*)\s?(km\/klst|km\/hour|km\/h|kilometres per hour|km|m\/s|mm|cm|metres|meters|m|kg|tonnes?|t|‰|%|years?|months?|weeks?|days?|hours?|minutes?|seconds?)\b/gi;

/**
 * A count stated without a unit — "12 penalty points", "300 thousand ISK".
 * Digits only, and never 1 or 2: "one or two lamps", "two driving lanes" and
 * "two cars" are incidental phrasing, and blanking them makes a card whose
 * answer is guessable without knowing anything.
 */
const BARE_NUMBER = /\b([3-9]|[1-9]\d{1,3})\s+(?=\p{L})/gu;

/** Signals that the sentence states a rule rather than narrating an example. */
const RULE_WORDS =
  /\b(must|shall|may not|limit|maximum|minimum|at least|no more than|not exceed|permitted|prohibited|required|mandatory|valid|allowed|forbidden)\b/i;

/** Things that are references or furniture, not facts to memorise. */
const REJECT =
  /\b(figure|fig\.|chapter|page|see the|table)\b|^\s*[\d.,\s]+$|\.{3}|[|_]{2,}/i;

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÝÞÆÖ])/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * A sentence is only usable if the OCR of it looks clean. The corpus runs
 * 96–99% real words, so a sentence with more than one unrecognisable token is
 * far more likely to be damaged than to be unusual.
 */
/** Every one- and two-letter word English actually uses. Anything else that
 *  short is a mangled abbreviation — "i.e." comes back as "le", "3,5 t" as "3,5 D". */
const SHORT_WORDS = new Set([
  'a', 'i', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it',
  'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
]);

function looksClean(s: string): boolean {
  const words = s.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (words.length < 6) return false;
  for (const w of words) {
    const lower = w.toLowerCase();
    if (w.length <= 2) {
      if (!SHORT_WORDS.has(lower)) return false;
      continue;
    }
    // Tokens with no vowel, or mixed-case interiors, are OCR damage.
    if (!/[aeiouyáéíóúýæö]/i.test(lower)) return false;
    if (/[a-z][A-Z]/.test(w)) return false;
  }
  return true;
}

/**
 * @param alreadyAsked For each chunk id, the correct answers of the authored MCQs
 *   that already cite it. A cloze drawn from the same passage and testing the same
 *   number is a second card for one fact: it inflates the deck, and SM-2 then
 *   schedules the two independently so the learner meets the same number twice on
 *   different days and reads it as two things to remember. Measured: 4 of the 7
 *   cloze cards duplicated an authored MCQ this way — "300 thousand ISK", "younger
 *   than 15 years", "Three months", "At least 100 compressions per minute".
 *   An authored question is the better card of the pair, because a human wrote its
 *   distractors from the fact; the cloze was pattern-matched out of a sentence.
 */
/** Only as far as the numbers this book states in prose actually go. */
const NUMBER_WORDS: Record<string, string> = {
  '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six',
  '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven',
  '12': 'twelve', '15': 'fifteen', '20': 'twenty', '30': 'thirty', '50': 'fifty',
  '100': 'hundred',
};

export function extractCloze(chunks: Chunk[], alreadyAsked: Map<string, string[]> = new Map()): ClozeCard[] {
  const cards: ClozeCard[] = [];
  const seen = new Set<string>();

  for (const c of chunks) {
    if (c.kind === 'toc' || c.kind === 'heading') continue;
    // Low-confidence text is exactly where OCR digits go wrong, and a wrong
    // number is the worst possible card.
    if (c.conf < 0.80) continue;

    const pieces = c.items?.length ? c.items : splitSentences(c.text);
    for (const raw of pieces) {
      const s = raw.trim().replace(/\s+/g, ' ');
      if (s.length < 45 || s.length > 220) continue;
      if (REJECT.test(s)) continue;
      // A sentence that does not finish was cut by a column or page break, and
      // its tail — often the qualifying clause — is missing.
      if (!c.items?.length && !/[.!?]$/.test(s)) continue;
      if (!looksClean(s)) continue;

      // Only sentences that state a rule. Without this the pass happily blanks
      // the number out of narration — "Let's consider a driver at 80 km/hour as
      // an example" — which tests nothing.
      if (!RULE_WORDS.test(s)) continue;
      // A sentence opening on a digit is the tail of one split across a column.
      if (/^\d/.test(s)) continue;
      // A full stop followed by lower case means two columns were spliced
      // together mid-sentence; the result reads as prose but is not one.
      if (/[a-z]\.\s+[a-z]/.test(s)) continue;

      let matches = [...s.matchAll(QUANTITY)];
      // Falling back to bare numbers catches the counts the book states without
      // a unit — "12 penalty points", "no more than eight passengers".
      if (!matches.length) matches = [...s.matchAll(BARE_NUMBER)];
      if (matches.length !== 1) continue; // two blanks in one sentence is ambiguous
      const m = matches[0]!;
      const quantity = m[0].trim();
      const number = m[1]!;
      const unit = m[2] ?? '';

      const text = s.replace(quantity, '____');
      // The blank must leave a self-contained question behind.
      if (text.startsWith('____')) continue;

      // …and the sentence around it has to be a sentence. Cloze cards were the one
      // card type that reached the app unvalidated, and it showed: one card read
      // "Driving more than 16 - ____ faster than the current speed limit." — a row
      // lifted out of the penalty-points table, with no subject and no verb, which
      // cannot be answered by someone who has not seen the table. Another began
      // "After the ____, that the driver didn't possess a valid license have
      // passed," where the OCR grammar had collapsed.
      //
      // Three cheap shape tests, all satisfied by every sentence the book actually
      // writes: it opens on a capital, it closes on a full stop, and it is not a
      // dangling range fragment ("16 - ____"). Rule-based extraction cannot judge
      // meaning, so it must at least refuse what is visibly not prose.
      if (!/^[A-ZÁÐÉÍÓÚÝÞÆÖ]/.test(text)) continue;
      if (!/\.$/.test(text.trim())) continue;
      if (/\d\s*[-–]\s*____/.test(text)) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;

      // Already covered by an authored question on this very passage?
      //
      // Comparing digits alone is not enough, and this was measured: the authored
      // card answers "Three months" in words where the cloze answers "3 months", so
      // a digit-only test let that duplicate through. Authors write small numbers
      // out; the book prints them as numerals.
      // The unit has to be part of the comparison. Matching the number alone is
      // wrong in both directions, and both were measured on this data: a bare-digit
      // test missed "3 months" against the authored "Three months", and then a
      // bare-word test wrongly suppressed "3 years" — the span in which 12 penalty
      // points accumulate — because the authored answer "Three months", a different
      // fact from the same passage, also contains "three".
      const digits = number.replace(/[.,]/g, '');
      const word = NUMBER_WORDS[digits];
      const u = unit.toLowerCase().replace(/s$/, '');
      const forms = [quantity.toLowerCase(), `${digits} ${u}`, word ? `${word} ${u}` : '']
        .filter(Boolean)
        .map((f) => f.replace(/s\b/g, '').replace(/\s+/g, ' ').trim());
      const covered = (alreadyAsked.get(c.id) ?? []).some((a) => {
        const t = a.toLowerCase().replace(/[.,]/g, '').replace(/s\b/g, '').replace(/\s+/g, ' ');
        return forms.some((f) => f.length > 1 && t.includes(f));
      });
      if (covered) continue;

      seen.add(key);

      const accept = [
        quantity,
        number,
        `${number} ${unit}`,
        `${number}${unit}`,
        number.replace(',', '.'),
        number.replace('.', ','),
      ];

      cards.push({
        id: `cloze:${c.id}:${cards.length}`,
        type: 'cloze',
        text,
        answer: quantity,
        accept: [...new Set(accept.map((a) => a.toLowerCase()))],
        topic: c.topics[0] ?? 'general',
        doc: c.doc,
        source: c.id,
        href: c.src.href,
      });
    }
  }

  return cards;
}
