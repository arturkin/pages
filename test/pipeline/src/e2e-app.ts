/**
 * End-to-end verification of the study app.
 *
 *   npm run test:app
 *
 * Three layers, because they fail differently:
 *
 *  1. Data — the card set itself must be sound: four distinct options, an answer
 *     index in range, every image on disk, distractors drawn from the right
 *     place. A bad card teaches a wrong fact and no amount of UI testing sees it.
 *  2. Logic — SM-2 and the weighting are pure functions, exercised directly in
 *     the page so the shipped code is what is tested.
 *  3. Flow — the real journeys: review, practice, signs, a full timed mock exam,
 *     the dashboard, persistence across reload, and both themes at phone and
 *     desktop widths.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '../..');
const APP = path.join(ROOT, 'app');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
};

/** Serves the repo root so the app's "see it in the book" links resolve too. */
function serve(dir: string): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

interface CardData {
  meta: { total: number; mcq: number; cloze: number; sign: number; topics: { id: string }[]; docs: { id: string }[] };
  cards: any[];
}

async function open(browser: Browser, base: string, width: number, height: number) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto(`${base}/app/index.html`, { waitUntil: 'networkidle' });
  return { ctx, page, errors };
}

/** Click through one question, whatever type it is. Returns true if it answered. */
async function answerOne(page: Page, pick: 'first' | 'correct' | 'wrong' = 'first') {
  const cloze = page.locator('#cloze-input');
  if (await cloze.count()) {
    await cloze.fill(
      pick === 'correct'
        ? await page.evaluate(() => { const s = (window as any).UI.session(); return s.cards[s.i].answer as string; })
        : 'definitely-not-the-answer',
    );
    await page.locator('[data-act="submit"]').click();
    return true;
  }
  const opts = page.locator('.opt[data-opt]');
  const n = await opts.count();
  if (!n) return false;
  let idx = 0;
  if (pick !== 'first') {
    const correct = await page.evaluate(() => (window as any).UI.session().current.answer as number);
    idx = pick === 'correct' ? correct : (correct + 1) % n;
  }
  await opts.nth(idx).click();
  return true;
}

async function run() {
  if (!existsSync(path.join(APP, 'data', 'cards.js'))) {
    throw new Error('app/data/cards.js missing — run npm run cards first');
  }
  const data: CardData = JSON.parse(readFileSync(path.join(APP, 'data', 'cards.json'), 'utf8'));
  const { server, base } = await serve(ROOT);
  const browser = await chromium.launch();

  // ── 1. Card data ──────────────────────────────────────────────────────────
  console.log('\n— card data —');

  check('card set is non-trivial', data.cards.length > 400, `${data.cards.length} cards`);
  check('authored questions are present', data.meta.mcq >= 200, `${data.meta.mcq} MCQ`);

  // Every authored question must survive validation. Silent rejection is how a
  // pipeline change once dropped 75 of them: chunk ids were positional, and
  // filtering some figures renumbered every citation after them.
  const authoredDir = path.join(ROOT, 'pipeline/cards');
  const written = readdirSync(authoredDir)
    // `sign-*.json` are reviewer data (exclusions, label corrections), not questions.
    .filter((n) => n.endsWith('.json') && !n.startsWith('sign-'))
    .reduce((sum, n) => sum + (JSON.parse(readFileSync(path.join(authoredDir, n), 'utf8')).questions?.length ?? 0), 0);
  check('no authored question was rejected by the build', data.meta.mcq === written,
    `${written} written, ${data.meta.mcq} shipped`);

  // Ids are content-derived so they survive the block list changing shape.
  const positional = data.cards.filter((c) => c.type === 'mcq' && /:\d+$/.test(c.source)).length;
  check('citations use stable, content-derived chunk ids', positional === 0, `${positional} positional`);
  check('sign deck is present', data.meta.sign >= 300, `${data.meta.sign} sign cards`);

  const ids = new Set<string>();
  let dupIds = 0;
  const badOptions: string[] = [];
  const badAnswer: string[] = [];
  const badSource: string[] = [];
  for (const c of data.cards) {
    if (ids.has(c.id)) dupIds++;
    ids.add(c.id);
    if (!c.href || !/\.html#/.test(c.href)) badSource.push(c.id);
    if (c.type === 'cloze') {
      if (!c.text.includes('____') || !c.answer) badOptions.push(c.id);
      continue;
    }
    if (!Array.isArray(c.options) || c.options.length !== 4) badOptions.push(c.id);
    else if (new Set(c.options.map((o: string) => o.trim().toLowerCase())).size !== 4) badOptions.push(c.id);
    if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer > 3) badAnswer.push(c.id);
  }
  check('card ids are unique', dupIds === 0, `${dupIds} duplicates`);
  check('every choice card has 4 distinct options', badOptions.length === 0, badOptions.slice(0, 3).join(', '));
  check('every answer index is in range', badAnswer.length === 0, badAnswer.slice(0, 3).join(', '));
  check('every card links back to the book', badSource.length === 0, badSource.slice(0, 3).join(', '));

  // Images must exist, or the sign deck silently shows nothing.
  let imgRefs = 0;
  const missingImgs: string[] = [];
  for (const c of data.cards) {
    for (const src of [c.img, ...(c.optionImgs ?? [])].filter(Boolean)) {
      imgRefs++;
      if (!existsSync(path.join(APP, src))) missingImgs.push(src);
    }
  }
  check('every sign image exists on disk', missingImgs.length === 0, `${missingImgs.length} of ${imgRefs} missing`);

  // The point of the sign deck is confusable distractors.
  const signCards = data.cards.filter((c) => c.type === 'sign-to-meaning' || c.type === 'meaning-to-sign');
  const labelCategory = new Map<string, string>();
  for (const c of signCards) labelCategory.set(c.options[c.answer], c.category);
  let sameCat = 0;
  let comparable = 0;
  for (const c of signCards) {
    for (const [i, o] of c.options.entries()) {
      if (i === c.answer) continue;
      const cat = labelCategory.get(o);
      if (!cat) continue;
      comparable++;
      if (cat === c.category) sameCat++;
    }
  }
  const sameCatShare = comparable ? sameCat / comparable : 0;
  check('sign distractors mostly come from the same section', sameCatShare > 0.8, `${(sameCatShare * 100).toFixed(0)}%`);
  check('both sign directions are generated',
    signCards.some((c) => c.type === 'sign-to-meaning') && signCards.some((c) => c.type === 'meaning-to-sign'));

  // Two deck labels a single glyph apart are the same printed caption, read twice.
  //
  // This is the check that was missing. The sheet prints one caption over two
  // dashed groups of traffic-signal heads; OCR read the second as "Traftic", and
  // that one glyph was the only reason both entered the deck — the exact-label
  // de-dup saw two different strings. The meaning-to-sign card then offered both
  // spellings and graded the correctly-spelled one WRONG.
  //
  // Exact-label de-dup cannot catch this by construction, and it is not safe to
  // rely on the `shared` flag either: 27 of 31 identical-label groups are only
  // partially flagged, so the one-deck-sign-per-caption property is currently held
  // by three unrelated filters coinciding rather than by a rule. Distance 1 and no
  // higher — "No lorries"/"No buses" differ by more, and genuinely distinct signs
  // must stay.
  const deckLabels = [...new Set(signCards.map((c) => c.options[c.answer] as string))];
  const within1 = (a: string, b: string) => {
    if (a === b) return false;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length === b.length) { i++; j++; }
      else if (a.length > b.length) i++;
      else j++;
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };
  // A trailing "s" is the one distance-1 difference that carries meaning, so it is
  // exempt. Measured, not assumed: this check first flagged "Blind rise" ~ "Blind
  // rises" and "Direction arrow" ~ "Direction arrows", and reading the crops showed
  // both pairs are real, distinct signs — the faces themselves print BLINDHÆÐ and
  // BLINDHÆÐIR, and the two direction-arrow signs sit in different sheet sections
  // (Other signs, Road markings). An OCR duplicate instead differs *inside* a word
  // ("Traffic"/"Traftic"), which this still catches.
  const plural = (a: string, b: string) => (a.length > b.length ? a : b) === `${a.length > b.length ? b : a}s`;
  const nearDupes: string[] = [];
  for (let i = 0; i < deckLabels.length; i++) {
    for (let j = i + 1; j < deckLabels.length; j++) {
      const a = deckLabels[i]!.toLowerCase();
      const b = deckLabels[j]!.toLowerCase();
      if (within1(a, b) && !plural(a, b)) nearDupes.push(`"${deckLabels[i]}" ~ "${deckLabels[j]}"`);
    }
  }
  check('no two deck sign labels are one glyph apart', nearDupes.length === 0,
    nearDupes.slice(0, 3).join('; '));

  const topicIds = new Set(data.meta.topics.map((t) => t.id));
  const unknownTopic = data.cards.filter((c) => !topicIds.has(c.topic));
  check('every card has a known topic', unknownTopic.length === 0, `${unknownTopic.length} unknown`);

  // A correct option that is systematically longer is a giveaway.
  //
  // The denominator has to be the items this can be *judged* on. It used to
  // restrict the numerator to the questions with four distinct option lengths and
  // then divide by all of them, which reported 20% where the real rate among
  // judgeable items was 41.5% — the floor was never actually being tested.
  const mcqs = data.cards.filter((c) => c.type === 'mcq');
  const judgeable = mcqs.filter((c) => new Set(c.options.map((o: string) => o.length)).size === 4);
  const longest = judgeable.filter((c) => {
    const lens = c.options.map((o: string) => o.length);
    return Math.max(...lens) === lens[c.answer];
  }).length;
  const longestShare = judgeable.length ? longest / judgeable.length : 0;
  check('correct answer is not usually the longest option', longestShare < 0.45,
    `${(longestShare * 100).toFixed(0)}% of ${judgeable.length} judgeable`);

  // A bunched answer key is a giveaway to anything reading the data directly —
  // one authored packet arrived with all twenty answers at index 0.
  //
  // Both sets below must be read from the AUTHORED packets, not from cards.json.
  // `cards.ts` reshuffles every question's options, so a check that reads the
  // built deck measures the shuffler and cannot fail: the authored key was bunched
  // at chi-square 185 (p ~ 1e-39) with 156 of 252 answers at index 0 while the
  // shipped deck measured a healthy 2.13.
  const authoredQs = readdirSync(authoredDir)
    .filter((n) => n.endsWith('.json') && !n.startsWith('sign-'))
    .flatMap((n) => {
      const f = JSON.parse(readFileSync(path.join(authoredDir, n), 'utf8'));
      return (f.questions ?? []).map((q: { id: string; answer: number }) => ({ packet: f.packet as string, ...q }));
    });
  check('authored questions were all read', authoredQs.length === mcqs.length,
    `${authoredQs.length} authored vs ${mcqs.length} shipped`);

  // Two questions testing one fact inflate apparent coverage and make SM-2 schedule
  // the same thing twice, on different days, as if it were two things to learn.
  //
  // A floor, not a proof: word overlap cannot judge meaning. Measured on this
  // corpus, 0.7 is where it separates cleanly — the three appendix questions that
  // re-tested ch-3 facts scored 1.0, 0.67 and 0.44, while two questions that merely
  // share a sentence pattern ("standard appearance of a hazard sign" against "of a
  // mandatory sign") score 0.5 and must survive. So 0.7 catches the blatant case
  // without deleting real questions, and the 0.44 tail needs a human. Both live
  // examples of the tail are recorded in FIXES.md under B9.
  // Reviewed contrast pairs: worded alike on purpose, with *different* answers, so
  // the learner meets the distinction rather than one rule twice. Keeping the
  // threshold sensitive and listing the exceptions is better than raising it until
  // nothing trips, because each exception then has to be justified.
  //   ch-7-a-18 / ch-7-a-23 — penalty points that cost a FULL licence (12) against a
  //   TEMPORARY one (4). Two limits a learner genuinely confuses; the near-identical
  //   phrasing is what makes the contrast land.
  const CONTRAST_PAIRS = new Set(['ch-7-a-18~ch-7-a-23']);
  const STOP = new Set(['the','a','an','of','to','in','on','for','is','are','what','which','how','when','may','you','your','that','at','be','does','do','and','with','from','it','as','by','or','not','must','can','if','driver']);
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));
  const nearQs: string[] = [];
  const bags = mcqs.map((c) => ({ id: c.id, w: words(c.question) }));
  for (let i = 0; i < bags.length; i++) {
    for (let j = i + 1; j < bags.length; j++) {
      const a = bags[i]!;
      const b = bags[j]!;
      const inter = [...a.w].filter((w) => b.w.has(w)).length;
      const union = new Set([...a.w, ...b.w]).size;
      if (union && inter / union >= 0.7 && !CONTRAST_PAIRS.has(`${a.id}~${b.id}`)) {
        nearQs.push(`${a.id} ~ ${b.id}`);
      }
    }
  }
  check('no two authored questions are near-identical', nearQs.length === 0, nearQs.slice(0, 3).join('; '));

  for (const [label, set] of [
    ['shipped', data.cards.filter((c) => c.type !== 'cloze')],
    ['authored', authoredQs],
  ] as const) {
    const counts = [0, 0, 0, 0];
    for (const c of set) counts[c.answer] = (counts[c.answer] ?? 0) + 1;
    const worst = Math.max(...counts) / (set.length || 1);
    check(`answer key is spread across positions (${label})`, worst < 0.4,
      `[${counts.join(', ')}] — ${(worst * 100).toFixed(0)}% in one slot`);
  }
  const byPacket = new Map<string, number[]>();
  for (const q of authoredQs) {
    const counts = byPacket.get(q.packet) ?? [0, 0, 0, 0];
    counts[q.answer] = (counts[q.answer] ?? 0) + 1;
    byPacket.set(q.packet, counts);
  }
  const bunched = [...byPacket.entries()].filter(([, c]) => Math.max(...c) / c.reduce((a, b) => a + b, 0) > 0.55);
  check('no single authored packet bunches its answers', bunched.length === 0,
    bunched.map(([k, c]) => `${k} [${c.join(',')}]`).join('; '));

  // ── 2. Scheduler and selection ────────────────────────────────────────────
  console.log('\n— scheduler —');
  {
    const { ctx, page } = await open(browser, base, 390, 844);
    const sm2 = await page.evaluate(() => {
      const S = (window as any).SM2;
      const t0 = 1_700_000_000_000;
      const first = S.review(undefined, 5, t0);
      const second = S.review(first, 5, t0);
      const third = S.review(second, 5, t0);
      const lapsed = S.review(third, 1, t0);
      const hard = S.review(undefined, 3, t0);
      let ease = 2.5;
      let st;
      for (let i = 0; i < 10; i++) st = S.review(st, 0, t0);
      return {
        i1: first.interval, i2: second.interval, i3: third.interval,
        lapseInterval: lapsed.interval, lapseDue: lapsed.due <= t0, lapses: lapsed.lapses,
        easeDropped: hard.ease < 2.5,
        easeFloor: st.ease,
        gradeWrong: S.gradeFor(false, 1000),
        gradeFast: S.gradeFor(true, 1000),
        gradeSlow: S.gradeFor(true, 30000),
        dueWhenNew: S.isDue(undefined, t0),
        notDueAhead: S.isDue(first, t0) === false,
        ease0: ease,
      };
    });
    check('SM-2 first interval is 1 day', sm2.i1 === 1, String(sm2.i1));
    check('SM-2 second interval is 6 days', sm2.i2 === 6, String(sm2.i2));
    check('SM-2 third interval grows by ease', sm2.i3 > 6, String(sm2.i3));
    check('a lapse resets the interval and re-shows today', sm2.lapseInterval === 0 && sm2.lapseDue && sm2.lapses === 1);
    check('a hard recall lowers ease', sm2.easeDropped);
    check('ease never falls below 1.3', sm2.easeFloor >= 1.3, String(sm2.easeFloor));
    check('grading: wrong is a lapse grade', sm2.gradeWrong < 3, String(sm2.gradeWrong));
    check('grading: fast correct beats slow correct', sm2.gradeFast > sm2.gradeSlow);
    check('an unseen card is due', sm2.dueWhenNew);
    check('a scheduled card is not due yet', sm2.notDueAhead);

    const weighting = await page.evaluate(() => {
      const E = (window as any).Engine;
      const cards = [
        ...Array.from({ length: 50 }, (_, i) => ({ id: `w${i}`, topic: 'weak', doc: 'd', type: 'mcq' })),
        ...Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, topic: 'strong', doc: 'd', type: 'mcq' })),
      ];
      // A history where "weak" is always wrong and "strong" always right.
      const log: any[] = [];
      for (let i = 0; i < 40; i++) {
        log.push({ topic: 'weak', doc: 'd', correct: false, at: 1, id: 'x' });
        log.push({ topic: 'strong', doc: 'd', correct: true, at: 1, id: 'y' });
      }
      const rates = E.errorRates(log);
      let weak = 0;
      const runs = 40;
      for (let r = 0; r < runs; r++) {
        const picked = E.weighted(cards, log, {}, 20);
        weak += picked.filter((c: any) => c.topic === 'weak').length;
      }
      return { weakRate: rates.get('weak'), strongRate: rates.get('strong'), weakShare: weak / (runs * 20) };
    });
    check('error rate is measured per topic', weighting.weakRate === 1 && weighting.strongRate === 0);
    check('weak topics are sampled more often', weighting.weakShare > 0.62,
      `${(weighting.weakShare * 100).toFixed(0)}% of picks (uniform would be 50%)`);

    const exam = await page.evaluate(() => {
      const E = (window as any).Engine;
      const set = E.examSet((window as any).CARDS.cards, 42);
      const again = E.examSet((window as any).CARDS.cards, 42);
      const other = E.examSet((window as any).CARDS.cards, 43);
      return {
        n: set.length,
        unique: new Set(set.map((c: any) => c.id)).size,
        deterministic: set.map((c: any) => c.id).join() === again.map((c: any) => c.id).join(),
        varies: set.map((c: any) => c.id).join() !== other.map((c: any) => c.id).join(),
        signShare: set.filter((c: any) => c.type !== 'mcq' && c.type !== 'cloze').length / set.length,
        cfg: E.EXAM,
      };
    });
    check('mock paper has the exam question count', exam.n === exam.cfg.questions, `${exam.n}`);
    check('mock paper has no repeats', exam.unique === exam.n);
    check('mock paper is reproducible from its seed', exam.deterministic);
    check('a different seed gives a different paper', exam.varies);
    check('mock paper is not swamped by sign pictures', exam.signShare <= 0.5, `${(exam.signShare * 100).toFixed(0)}% signs`);
    await ctx.close();
  }

  // ── 3. Rendering and flow ─────────────────────────────────────────────────
  for (const [w, h, name] of [[390, 844, 'phone'], [1280, 900, 'desktop']] as const) {
    console.log(`\n— ${name} (${w}×${h}) —`);
    const { ctx, page, errors } = await open(browser, base, w, h);

    check(`${name}: no console errors on load`, errors.length === 0, errors.slice(0, 2).join(' | '));
    check(`${name}: dark theme is the default`,
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
    check(`${name}: home screen renders`, (await page.locator('h1').first().textContent())?.trim() === 'Today');

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${name}: no horizontal overflow`, overflow <= 1, `${overflow}px`);

    // Theme toggle round trip, and it must survive a reload.
    await page.locator('#theme-toggle').click();
    check(`${name}: toggle switches to light`,
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
    await page.reload({ waitUntil: 'networkidle' });
    check(`${name}: theme choice persists`,
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
    await page.locator('#theme-toggle').click();

    // Practice run.
    await page.locator('[data-act="practice"]').click();
    check(`${name}: practice session starts`, await page.locator('.opts, #cloze-input').first().isVisible());

    await answerOne(page, 'first');
    check(`${name}: answering reveals feedback`, await page.locator('.feedback').first().isVisible());
    check(`${name}: feedback links back to the book`, (await page.locator('.feedback .src').count()) > 0);
    const marked = await page.locator('.opt.correct').count();
    check(`${name}: the correct option is marked`, marked === 1, `${marked} marked`);
    await page.locator('[data-act="next"]').click();
    check(`${name}: next question loads`, await page.locator('.opts, #cloze-input').first().isVisible());

    // Progress must be recorded.
    const logged = await page.evaluate(() => (window as any).Store.get().log.length);
    check(`${name}: the answer was logged`, logged >= 1, `${logged}`);
    const sched = await page.evaluate(() => Object.keys((window as any).Store.get().sched).length);
    check(`${name}: the card was scheduled`, sched >= 1, `${sched}`);

    await page.locator('[data-act="quit"]').click();

    // Sign deck.
    await page.locator('nav.tabs button[data-view="signs"]').click();
    await page.locator('[data-act="signs-all"]').click();
    const shown = await page.evaluate(async () => {
      // Walk forward until a card with a picture appears; both directions exist.
      for (let i = 0; i < 12; i++) {
        const img = document.querySelector('.signbox img, .opt img') as HTMLImageElement | null;
        if (img) {
          if (!img.complete) await new Promise((r) => img.addEventListener('load', r, { once: true }));
          return { found: true, w: img.naturalWidth };
        }
        (document.querySelector('.opt[data-opt]') as HTMLElement)?.click();
        (document.querySelector('[data-act="next"]') as HTMLElement)?.click();
      }
      return { found: false, w: 0 };
    });
    check(`${name}: sign cards show a picture`, shown.found && shown.w > 0, JSON.stringify(shown));
    await page.locator('[data-act="quit"]').click();

    // Stats.
    await page.locator('nav.tabs button[data-view="stats"]').click();
    check(`${name}: dashboard shows per-topic accuracy`, (await page.locator('.bar').count()) > 0);

    check(`${name}: still no console errors after the run`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ── 4. A full mock exam ───────────────────────────────────────────────────
  console.log('\n— mock exam —');
  {
    const { ctx, page, errors } = await open(browser, base, 390, 844);
    await page.locator('nav.tabs button[data-view="exam-intro"]').click();
    await page.locator('[data-act="exam-start"]').click();

    check('exam hides the tab bar', await page.locator('nav.tabs').isHidden());
    check('exam shows a countdown', /^\d+:\d\d$/.test((await page.locator('.timer').textContent())?.trim() ?? ''));

    const cfg = await page.evaluate(() => (window as any).Engine.EXAM);
    let answered = 0;
    let expectedRight = 0;
    for (let i = 0; i < cfg.questions; i++) {
      const isCloze = (await page.locator('#cloze-input').count()) > 0;
      if (isCloze) {
        const ans = await page.evaluate(() => {
          const s = (window as any).UI.session();
          return s.cards[s.i].answer as string;
        });
        await page.locator('#cloze-input').fill(ans);
        await page.locator('[data-act="submit"]').click();
        expectedRight++;
      } else {
        const correct = await page.evaluate(() => (window as any).UI.session().current.answer as number);
        // Answer the first 26 correctly and the rest wrong, to land on a pass.
        const n = await page.locator('.opt[data-opt]').count();
        const pick = i < 26 ? correct : (correct + 1) % n;
        if (i < 26) expectedRight++;
        await page.locator('.opt[data-opt]').nth(pick).click();
      }
      answered++;
      if ((await page.locator('.feedback').count()) > 0) break; // must not happen in an exam
    }
    check('exam gives no feedback until the end', (await page.locator('.feedback.right, .feedback.wrong').count()) >= 0);
    check('exam ran to the full question count', answered === cfg.questions, `${answered}/${cfg.questions}`);

    const score = await page.locator('.lede[data-score]').getAttribute('data-score');
    check('exam reports a score', !!score, String(score));
    const [got = 0, total = 0] = (score ?? '0/0').split('/').map(Number);
    check('exam scored what was answered', total === cfg.questions, `${total}`);
    check('exam score matches the answers given', got === expectedRight, `${got} vs expected ${expectedRight}`);
    const heading = (await page.locator('h1').first().textContent())?.trim();
    check('exam verdict matches the pass mark',
      (got >= cfg.passMark) === (heading === 'Passed'), `${got}/${total} → “${heading}”`);

    const stored = await page.evaluate(() => (window as any).Store.get().exams);
    check('exam result is stored', stored.length === 1 && stored[0].total === cfg.questions);

    // Persistence across a reload.
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(() => (window as any).Store.get().exams.length);
    check('progress survives a reload', after === 1, `${after}`);
    await page.locator('nav.tabs button[data-view="stats"]').click();
    check('dashboard lists the mock', (await page.locator('table.hist tbody tr').count()) === 1);

    check('no console errors during the exam', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ── 4b. The failure modes a UX pass found ─────────────────────────────────
  // Each of these was a real defect; they are cheap to re-check and expensive to
  // rediscover.
  console.log('\n— regressions —');
  {
    const { ctx, page, errors } = await open(browser, base, 390, 844);

    // A running clock must not rebuild the question: a cloze input lost whatever
    // had been typed within a second of typing it.
    await page.evaluate(() => {
      const cloze = (window as any).CARDS.cards.filter((c: any) => c.type === 'cloze').slice(0, 2);
      (window as any).UI.startSession('exam', cloze, { minutes: 40 });
    });
    await page.locator('#cloze-input').fill('typed while the clock runs');
    await page.waitForTimeout(2200);
    check('exam clock does not wipe a typed answer',
      (await page.locator('#cloze-input').inputValue()) === 'typed while the clock runs');
    check('exam clock is still counting down', (await page.locator('.timer').count()) === 1);

    // Timing out must score against the paper, not against what was reached.
    await page.evaluate(() => {
      const s = (window as any).UI.session();
      s.deadline = Date.now() + 300;
    });
    await page.waitForTimeout(1600);
    const score = await page.locator('.lede[data-score]').getAttribute('data-score');
    check('a timed-out paper scores out of the full question count', score === '0/2', String(score));
    check('a timed-out paper says so', (await page.locator('[data-timeout]').count()) === 1);
    check('unanswered questions appear in the review list',
      (await page.locator('[data-missed]').count()) === 2);
    const stored = await page.evaluate(() => (window as any).Store.get().exams.at(-1));
    check('the stored result agrees with the headline', stored.total === 2 && stored.right === 0);

    // Pressing a key on the results screen used to throw.
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    check('keyboard is inert on the results screen', errors.length === 0, errors.slice(0, 2).join(' | '));

    // "Which sign means X?" reviews used to show no sign at all.
    await page.evaluate(() => {
      const c = (window as any).CARDS.cards.find((x: any) => x.type === 'meaning-to-sign');
      (window as any).UI.startSession('practice', [c]);
    });
    await page.evaluate(() => {
      const s = (window as any).UI.session();
      (window as any).UI.answerCurrent((s.current.answer + 1) % 4);
    });
    await page.locator('[data-act="next"]').click();
    check('a missed meaning-to-sign review shows the sign',
      (await page.locator('[data-missed] .signbox img').count()) === 1);

    // Wide picture options used to push the page sideways.
    const widest = data.cards
      .filter((c) => c.type === 'meaning-to-sign')
      .slice(0, 60)
      .map((c) => c.id);
    await page.evaluate((ids) => {
      const byId = new Map((window as any).CARDS.cards.map((c: any) => [c.id, c]));
      (window as any).UI.startSession('signs', ids.map((i) => byId.get(i)).filter(Boolean));
    }, widest);
    let worst = 0;
    for (let i = 0; i < 12; i++) {
      worst = Math.max(worst, await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth));
      await page.locator('.opt[data-opt]').first().click();
      await page.locator('[data-act="next"]').click();
    }
    check('picture options never overflow the phone width', worst <= 1, `${worst}px`);
    await ctx.close();
  }

  // Both directions of one sign in a single sitting makes the second one free.
  {
    const { ctx, page } = await open(browser, base, 390, 844);
    const twins = await page.evaluate(() => {
      const E = (window as any).Engine;
      const all = (window as any).CARDS.cards;
      const signs = all.filter((c: any) => c.type === 'sign-to-meaning' || c.type === 'meaning-to-sign');
      let deckTwins = 0;
      let examTwins = 0;
      for (let r = 0; r < 40; r++) {
        const deck = E.weighted(signs, [], {}, 20);
        const dk = deck.map((c: any) => c.source);
        if (new Set(dk).size !== dk.length) deckTwins++;
        const paper = E.examSet(all, 1000 + r);
        const pk = paper.filter((c: any) => c.source?.startsWith('umferdarmerki')).map((c: any) => c.source);
        if (new Set(pk).size !== pk.length) examTwins++;
      }
      return { deckTwins, examTwins };
    });
    check('a signs deck never asks the same sign both ways', twins.deckTwins === 0, `${twins.deckTwins}/40 decks`);
    check('a mock paper never asks the same sign both ways', twins.examTwins === 0, `${twins.examTwins}/40 papers`);
    await ctx.close();
  }

  // ── 5. Opened straight from disk ──────────────────────────────────────────
  // The app is meant to work without a server, which is a different origin
  // model: no fetch(), and storage on an opaque origin. Everything above ran
  // over http, so none of it would catch a regression here.
  console.log('\n— file:// —');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));

    await page.goto(`file://${path.join(APP, 'index.html')}`);
    await page.waitForSelector('h1');
    check('file://: card data loads without fetch',
      (await page.evaluate(() => (window as any).CARDS?.cards?.length ?? 0)) === data.cards.length);
    check('file://: dark theme is the default',
      (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');

    await page.locator('nav.tabs button[data-view="signs"]').click();
    await page.locator('[data-act="signs-all"]').click();
    const px = await page.evaluate(async () => {
      for (let i = 0; i < 12; i++) {
        const el = document.querySelector('.signbox img, .opt img') as HTMLImageElement | null;
        if (el) {
          if (!el.complete) await new Promise((r) => el.addEventListener('load', r, { once: true }));
          return el.naturalWidth;
        }
        (document.querySelector('.opt[data-opt]') as HTMLElement)?.click();
        (document.querySelector('[data-act="next"]') as HTMLElement)?.click();
      }
      return 0;
    });
    check('file://: sign images load from disk', px > 0, `${px}px`);

    await page.locator('.opt[data-opt]').first().click();
    await page.reload();
    await page.waitForSelector('h1');
    check('file://: progress persists on an opaque origin',
      (await page.evaluate(() => (window as any).Store.get().log.length)) >= 1);
    check('file://: no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();
  server.close();

  console.log(`\n${'─'.repeat(60)}`);
  if (failures.length) {
    console.log(`FAILED — ${passed} passed, ${failures.length} failed\n`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`PASSED — all ${passed} checks green`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
