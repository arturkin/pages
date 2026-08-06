/**
 * Card selection, error weighting, and the mock exam.
 *
 * Three ways to pick cards:
 *   dueCards   — what SM-2 says is ready today; the home screen's list
 *   weighted   — practice, biased towards the topics you get wrong
 *   examSet    — a fixed-length paper matching the real test's shape
 */

const EXAM = {
  /** The Icelandic theory test as administered by Frumherji. Not stated in the
   *  textbook, so it is declared here rather than derived from the content. */
  questions: 30,
  passMark: 25,
  minutes: 40,
};

/** Answers within this window count as "recent" for the error weighting. */
const RECENT = 50;

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rnd = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Recent error rate per topic.
 *
 * Only the last few answers per topic count: the point is to chase the topics
 * you are getting wrong *now*, not ones you fixed a hundred cards ago.
 */
function errorRates(log) {
  const byTopic = new Map();
  for (const e of log.slice(-RECENT * 8)) {
    const list = byTopic.get(e.topic) || [];
    list.push(e);
    byTopic.set(e.topic, list);
  }
  const rates = new Map();
  for (const [topic, entries] of byTopic) {
    const recent = entries.slice(-RECENT);
    const wrong = recent.filter((e) => !e.correct).length;
    rates.set(topic, wrong / recent.length);
  }
  return rates;
}

/** weight = 1 + 3 × recent error rate, plus a nudge for cards never seen. */
function weightFor(card, rates, sched) {
  const base = 1 + 3 * (rates.get(card.topic) ?? 0);
  return sched[card.id] ? base : base * 1.5;
}

function dueCards(cards, sched, now = Date.now()) {
  return cards.filter((c) => window.SM2.isDue(sched[c.id], now));
}

/**
 * How many *live* cards have a schedule entry.
 *
 * `sched` accumulates one record per card ever answered and never prunes a
 * retired id, so `Object.keys(sched).length` counts signs and questions that
 * left the deck — a returning student's "Seen" tile only grows. Walking the
 * live deck instead means a retired id simply stops being counted, with
 * nothing deleted from storage (it can legitimately come back).
 */
function seenCount(cards, sched) {
  return cards.reduce((n, c) => n + (sched[c.id] ? 1 : 0), 0);
}

/**
 * Both directions of one sign are separate cards sharing an image and an answer
 * phrase. Asking both in the same sitting makes the second one free — its answer
 * was just printed on screen — so a session takes at most one direction per sign.
 */
const signKey = (card) => card.source ?? card.id;

/** Weighted sample without replacement, one direction per sign. */
function weighted(cards, log, sched, n, rnd = Math.random) {
  const rates = errorRates(log);
  const pool = cards.map((c) => ({ card: c, w: weightFor(c, rates, sched) }));
  const picked = [];
  const usedSigns = new Set();
  let total = pool.reduce((s, p) => s + p.w, 0);
  while (picked.length < n && pool.length) {
    let r = rnd() * total;
    let i = 0;
    while (i < pool.length - 1 && r > pool[i].w) {
      r -= pool[i].w;
      i++;
    }
    total -= pool[i].w;
    const { card } = pool.splice(i, 1)[0];
    const key = signKey(card);
    if (usedSigns.has(key)) continue;
    usedSigns.add(key);
    picked.push(card);
  }
  return picked;
}

/** Keep the first card seen for each sign, dropping its opposite direction. */
function oneDirectionPerSign(cards) {
  const seen = new Set();
  return cards.filter((c) => {
    const key = signKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A mock paper.
 *
 * Composition mirrors the real test rather than the card pool: the pool is
 * dominated by sign images (there are hundreds of signs and only so much
 * prose), and a paper that was four-fifths pictures would not resemble the
 * exam. Selection is unweighted — a mock is meant to measure, not to coach.
 */
function examSet(cards, seed = Date.now()) {
  const rnd = mulberry32(seed >>> 0);
  const signs = cards.filter((c) => c.type === 'sign-to-meaning' || c.type === 'meaning-to-sign');
  const prose = cards.filter((c) => c.type === 'mcq' || c.type === 'cloze');

  const wantSigns = Math.min(signs.length, Math.round(EXAM.questions * 0.4));
  const wantProse = Math.min(prose.length, EXAM.questions - wantSigns);
  const chosen = [
    ...oneDirectionPerSign(shuffled(signs, rnd)).slice(0, wantSigns),
    ...shuffled(prose, rnd).slice(0, wantProse),
  ];
  // Top up from whatever is left if one side ran short.
  if (chosen.length < EXAM.questions) {
    const used = new Set(chosen.map((c) => c.id));
    chosen.push(...shuffled(cards.filter((c) => !used.has(c.id)), rnd).slice(0, EXAM.questions - chosen.length));
  }
  return shuffled(chosen, rnd);
}

/** Per-topic and per-document accuracy, for the dashboard. */
function stats(log) {
  const mk = () => ({ n: 0, right: 0 });
  const byTopic = new Map();
  const byDoc = new Map();
  for (const e of log) {
    const t = byTopic.get(e.topic) || mk();
    t.n++;
    if (e.correct) t.right++;
    byTopic.set(e.topic, t);
    const d = byDoc.get(e.doc) || mk();
    d.n++;
    if (e.correct) d.right++;
    byDoc.set(e.doc, d);
  }
  return { byTopic, byDoc };
}

window.Engine = { EXAM, dueCards, seenCount, weighted, examSet, errorRates, stats, shuffled, mulberry32, oneDirectionPerSign };
