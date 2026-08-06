/**
 * End-to-end verification of the generated site.
 *
 *   npm run test:e2e
 *
 * Two things are checked, because "it renders" and "the text is right" are
 * different failures:
 *
 *  1. Rendering — every document loads in a phone and a desktop viewport with no
 *     console errors, no failed image requests, and no horizontal page overflow.
 *  2. Transcription — ground-truth passages read by eye from the scans must be
 *     present verbatim, page furniture must be classified correctly, and each
 *     document's prose must clear a lexicon-coverage floor. A broken OCR or
 *     layout stage shows up as garbled words, which coverage catches even where
 *     no ground-truth string was pinned.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type ConsoleMessage } from 'playwright';
import { frameCut, pageBody, type FigureRegion, type OcrLine, type OcrPage } from './layout.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SITE = path.join(ROOT, 'site');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Assertions

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground truth
//
// Passages transcribed by eye from the page scans. These are the real test of
// recognition: they must appear verbatim in the generated HTML.

interface GroundTruth {
  doc: string;
  label: string;
  text: string;
}

const GROUND_TRUTH: GroundTruth[] = [
  {
    doc: 'ch-1-2',
    label: 'chapter 1 title',
    text: 'Learning how to drive',
  },
  {
    doc: 'ch-1-2',
    label: 'chapter 1 opening sentence',
    text:
      'The Icelandic driving class follows a curriculum set by the Icelandic Transport Authority. ' +
      'At the age of sixteen you are allowed to learn how to drive.',
  },
  {
    doc: 'ch-1-2',
    label: 'practice-driving paragraph',
    text:
      'The purpose of the practice driving label is to make other drivers aware that you are practicing ' +
      'so they can act accordingly',
  },
  {
    doc: 'ch-1-2',
    label: 'emergency number in contents (inner-margin text)',
    text: 'To seek assistance if possible, and call the emergency hot line: 1-1-2.',
  },
  {
    doc: 'ch-1-2',
    label: 'driving-course ledger paragraph',
    text: 'Your driving instructor will give you a driving course ledger',
  },
  {
    doc: 'ch-1-2',
    label: 'ten lessons before practice driving',
    text: 'you will take at least 10 driving lessons (each one is 45 minutes) before you start practice driving',
  },
];

const GROUND_TRUTH_EXTRA: GroundTruth[] = [
  // The appendix spreads are stored sideways; if orientation detection regresses,
  // the gutter is searched across the wrong axis and these never appear.
  { doc: 'appendix', label: 'mandatory signs section', text: 'Mandatory signs' },
  { doc: 'appendix', label: 'informative signs section', text: 'Informative signs' },
  { doc: 'appendix', label: 'sign description prose', text: 'Path for pedestrians and bicycle riders only.' },
  // Sign-sheet labels come from the grid pairing, not prose flow.
  { doc: 'umferdarmerki-enska', label: 'sign label: no pedestrians', text: 'No pedestrians' },
  { doc: 'umferdarmerki-enska', label: 'sign label: width limit', text: 'Width limit' },
  { doc: 'umferdarmerki-enska', label: 'sign label: stop and give way', text: 'Stop and Give Way' },
];

/** Page-number column of the contents page — lost if the gutter split drifts. */
const TOC_PAGE_NUMBERS = ['135', '136', '141', '143', '144', '154', '156', '158'];

/**
 * Contents rows whose folio was verified by hand against the section's own page.
 * The published numbers were uniformly one too low until the leader column was
 * paired by geometry rather than by reading order, so these pin the direction.
 */
const TOC_FOLIOS: [string, string][] = [
  ['Hazard signs', '21'],
  ['Prohibitive signs', '22'],
  ['Mandatory signs', '23'],
  ['Road surface markings', '28'],
  ['Traffic lights', '33'],
];

const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/[‐-―]/g, '-').trim();

// ─────────────────────────────────────────────────────────────────────────────
// Lexicon coverage

function loadLexicon(): Set<string> {
  const words = new Set<string>();
  for (const p of ['/usr/share/dict/words', '/usr/share/dict/web2']) {
    if (!existsSync(p)) continue;
    for (const w of readFileSync(p, 'utf8').split('\n')) {
      const t = w.trim().toLowerCase();
      if (t.length >= 2) words.add(t);
    }
    break;
  }
  // Domain vocabulary and Icelandic proper nouns absent from the system list.
  for (const w of [
    'ok', 'tv', 'uk', 'eu', 'gps', 'abs', 'cpr', 'aed', 'atv', 'kg', 'km', 'kmh', 'mph', 'atvs',
    'reykjavík', 'reykjavik', 'ísland', 'íslandi', 'iceland', 'icelandic', 'ökukennsla',
    'ökunámsbók', 'æfingaakstur', 'umferðarstofa', 'vegagerðin', 'samgöngustofa', 'umferðarmerki',
    'roundabout', 'roundabouts', 'motorway', 'motorways', 'unpaved', 'signage', 'seatbelt',
    'seatbelts', 'defibrillator', 'resuscitation', 'cardiopulmonary', 'pedestrians', 'cyclists',
    'signalling', 'signalled', 'manoeuvre', 'manoeuvring', 'maneuvering', 'maneuver', 'tyre',
    'tyres', 'kerb', 'kerbs', 'lorries', 'lorry', 'headlights', 'taillights', 'windscreen',
    'litres', 'centre', 'metres', 'kilometres', 'labelled', 'travelling', 'ie', 'eg', 'etc',
    'rearside', 'drivings', 'gravel', 'blindspot', 'blindspots', 'overtaking', 'overtake',
  ]) {
    words.add(w);
  }
  return words;
}

/**
 * Is this token a real word, allowing for inflection?
 *
 * The system word list holds mostly base forms — "braking", "called" and
 * "needed" are all absent — so a bare lookup would flag correct text as OCR
 * damage and hide real regressions in the noise.
 */
function known(t: string, lex: Set<string>): boolean {
  if (lex.has(t)) return true;
  const stems = (suffix: string, base: string): string[] => {
    if (!t.endsWith(suffix)) return [];
    const b = t.slice(0, -suffix.length);
    if (b.length < 2) return [];
    return [
      b,                                    // walk+ed
      b + base,                             // brak+ing → brake
      b.slice(0, -1),                        // stopp+ing → stop (doubled consonant)
      b + 'y',                              // carr+ied → carry
    ];
  };
  const cands = [
    ...stems("'s", 'e'), ...stems('s', 'e'), ...stems('es', 'e'),
    ...stems('ed', 'e'), ...stems('ing', 'e'), ...stems('er', 'e'),
    ...stems('est', 'e'), ...stems('ly', ''), ...stems('ies', 'y'),
  ];
  return cands.some((c) => lex.has(c));
}

/** Share of prose tokens that are dictionary words — a proxy for OCR sanity. */
function lexiconCoverage(text: string, lex: Set<string>): { frac: number; total: number; bad: string[] } {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ''))
    // Very short tokens are dominated by initials and list markers.
    .filter((t) => t.length >= 3);
  if (!tokens.length) return { frac: 1, total: 0, bad: [] };
  const bad: string[] = [];
  let good = 0;
  for (const t of tokens) {
    if (known(t, lex)) good++;
    else bad.push(t);
  }
  return { frac: good / tokens.length, total: tokens.length, bad };
}

// ─────────────────────────────────────────────────────────────────────────────

const DOC_SLUGS = [
  'ch-1-2', 'ch-3', 'ch-4', 'ch-5', 'ch-6', 'ch-7', 'ch-8', 'appendix', 'umferdarmerki-enska',
];

/** OCR filename stem for a published page, e.g. ch-4 + 19a → "Ch. 4-p019a". */
const OCR_BASE: Record<string, string> = {
  'ch-1-2': 'Ch. 1–2', 'ch-3': 'Ch. 3', 'ch-4': 'Ch. 4', 'ch-5': 'Ch. 5',
  'ch-6': 'Ch. 6', 'ch-7': 'Ch. 7', 'ch-8': 'Ch. 8', appendix: 'Appendix',
};

/** Fold to comparable text: HTML entities out, punctuation and case flattened. */
const flat = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const pageSections = (html: string): { id: string; body: string }[] =>
  [...html.matchAll(/<section class="page" id="(p-[0-9ab]+)"[\s\S]*?\n<\/section>/g)].map((m) => ({
    id: m[1]!,
    body: m[0].replace(/<details class="scan">[\s\S]*?<\/details>/g, ''),
  }));

/**
 * Does every published ordered-list item carry the number the book printed for it?
 *
 * This is the check that was missing when an interleaved column split the 18-item
 * dashboard legend on p. 97 into seven <ol> blocks that each restarted at 1, and
 * broke the four-step Red Cross procedure on p. 141 across three. Each rendered
 * item is matched back to the enumerated OCR line it came from — by the text after
 * the enumerator, skipping anything ambiguous — and the number the browser will
 * show is compared against the printed one. Measured: 81 of the corpus's items
 * match a printed enumerator unambiguously, and 0 are numbered wrongly. Before the
 * fix the same check found 44 wrong out of 85 across six pages.
 */
function orderedListNumbering(): { checked: number; wrong: string[] } {
  const wrong: string[] = [];
  let checked = 0;
  for (const [slug, base] of Object.entries(OCR_BASE)) {
    const html = readFileSync(path.join(SITE, `${slug}.html`), 'utf8');
    for (const sec of pageSections(html)) {
      const m = /^p-(\d+)([ab])$/.exec(sec.id);
      if (!m) continue;
      const ocr = path.join(ROOT, 'build/work/ocr', `${base}-p${m[1]!.padStart(3, '0')}${m[2]}.json`);
      if (!existsSync(ocr)) continue;
      const lines: { text: string }[] = JSON.parse(readFileSync(ocr, 'utf8')).lines ?? [];
      const printed: { n: number; rest: string }[] = [];
      for (const l of lines) {
        const e = /^(\d{1,2})[.)]\s+(.+)$/.exec(l.text.trim());
        if (e) printed.push({ n: Number(e[1]), rest: flat(e[2]!) });
      }
      for (const ol of sec.body.matchAll(/<ol(?: start="(\d+)")?[^>]*>([\s\S]*?)<\/ol>/g)) {
        const start = Number(ol[1] ?? 1);
        [...ol[2]!.matchAll(/<li>([\s\S]*?)<\/li>/g)].forEach((li, j) => {
          const item = flat(li[1]!);
          if (item.length < 8) return;
          // An item is the enumerated line plus any continuation lines, so the
          // printed remainder is a prefix of it. Only accept a unique match.
          const hits = printed.filter((p) => p.rest.length >= 8 && item.startsWith(p.rest.slice(0, 40)));
          if (hits.length !== 1) return;
          checked++;
          if (hits[0]!.n !== start + j) {
            wrong.push(`${slug} ${sec.id}: shows ${start + j}, book prints ${hits[0]!.n} ("${item.slice(0, 44)}")`);
          }
        });
      }
    }
  }
  return { checked, wrong };
}

/**
 * Does each contents row's folio actually name the page the section starts on?
 *
 * The audit's method, mechanised: take the folio published beside a contents entry,
 * find the page that prints that folio, and look for the entry's own title on it.
 * Chapter and appendix rows are skipped — they name a whole chapter rather than a
 * heading set in the text. Measured after the fix: 81 rows testable, 77 found
 * (95.1%). The four that miss are headings the OCR dropped or garbled on the target
 * page, all recorded in scans.md §B4/B5, not pairing errors. Under the old
 * off-by-one pairing the same comparison resolved 22%.
 */
function tocFolios(): { testable: number; ok: number; miss: string[] } {
  const byFolio = new Map<string, string>();
  const files = readdirSync(SITE).filter((n) => n.endsWith('.html') && n !== 'index.html' && n !== 'qa.html');
  for (const f of files) {
    for (const sec of pageSections(readFileSync(path.join(SITE, f), 'utf8'))) {
      const lab = /<span class="pnum">p\. (\d{1,3})<\/span>/.exec(sec.body);
      if (!lab) continue;
      const txt = sec.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      byFolio.set(lab[1]!, (byFolio.get(lab[1]!) ?? '') + ' ' + txt);
    }
  }
  const miss: string[] = [];
  let testable = 0;
  let ok = 0;
  for (const f of files) {
    const html = readFileSync(path.join(SITE, f), 'utf8');
    for (const li of html.matchAll(/<li><span class="toc-t">([\s\S]*?)<\/span><span class="toc-p">(\d*)<\/span><\/li>/g)) {
      const title = li[1]!.replace(/&amp;/g, '&').replace(/^\d{1,2}\.\s*/, '').trim();
      const page = li[2]!;
      if (!page || title.length < 8 || /^(chapter|appendix)\b/i.test(title)) continue;
      const body = byFolio.get(page);
      if (!body) continue;
      testable++;
      if (body.includes(title.toLowerCase())) ok++;
      else miss.push(`${title} → p.${page}`);
    }
  }
  return { testable, ok, miss };
}

// ─────────────────────────────────────────────────────────────────────────────
// Column frames
//
// `frameCut` now ships inside `proseBlocks`, so the purity check's oracle and its
// subject are the same function. It can no longer detect a *wrong* frame
// partition — a mis-cut page is mis-cut identically on both sides of the
// comparison. What it still catches is a regression in how the frames are
// reassembled downstream: `paragraphize` per column, `extras.sort`, and
// `dataset.ts`'s chunking. That is narrower than it was, and load-bearing —
// three of this session's four stages moved exactly that code. The figcaption
// ceiling is independent of `frameCut` and measures the published site directly.

/** Laid out as a labelled grid by buildSignPage, which never detects columns. */
const SIGN_LAYOUT_DOCS = new Set(['umferdarmerki-enska']);
/** Per-sign crops rather than the generic picture finder, as dataset.ts does. */
const SIGN_PICTURE_DOCS = new Set(['appendix']);

interface CropRow { file: string; verdict: string; w: number; h: number; contentFrac: number }
interface DatasetChunk { id: string; doc: string; kind: string; text: string; src: { scan: string } }

/** The published text re-flows an OCR line's whitespace and nothing else. */
const reflow = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Crops build-html refuses to publish: the verdict filter and aspect test of its
 * `isRule`, minus the hand-reviewed grade overrides (pipeline/figure-grade-overrides.json)
 * that build-html also honours — each entry there was opened and confirmed by eye
 * to be a real illustration checkcrops' text-only heuristic misjudged. Repeated
 * rather than imported: loading build-html rebuilds site/ as a side effect, and
 * this suite is serving that directory.
 */
function rejectedCropFiles(work: string): Set<string> {
  const crops: CropRow[] = JSON.parse(readFileSync(path.join(work, 'crop-qa.json'), 'utf8'));
  const overridesPath = path.join(ROOT, 'pipeline/figure-grade-overrides.json');
  const overrides = new Set<string>(
    existsSync(overridesPath)
      ? (JSON.parse(readFileSync(overridesPath, 'utf8')) as { file: string }[]).map((o) => o.file)
      : [],
  );
  return new Set(
    crops
      .filter(
        (c) =>
          !overrides.has(c.file) &&
          (c.verdict === 'text-only' ||
            c.verdict === 'blank' ||
            (Math.max(c.w / c.h, c.h / c.w) >= 6 && c.contentFrac < 0.12)),
      )
      .map((c) => c.file),
  );
}

/**
 * Every "Figure N.M" the book's own prose refers to must have a published crop
 * somewhere on its page. This is the permanent form of the phase-1 oracle that
 * found the 20 rescued/missing figures fixed alongside this check — same three
 * hard-won corrections, re-derived here rather than copied so the check runs
 * off the live build:
 *
 *  1. Match by *vertical containment* (a caption's y-position must fall inside
 *     a candidate region's y..y+h band, ±MARGIN), not by counting figures per
 *     page — page-counting is what let Figure 6.16/6.17 (real, adjacent
 *     figures) get misclassified in an earlier pass of this same investigation.
 *  2. Exclude `isRule` crops (the decorative header rule / gutter slivers,
 *     see build-html's `isRule`) from the candidate pool entirely — they are
 *     page furniture, never a figure, and must not absorb a caption as either
 *     a hit or a miss.
 *  3. Treat every `pipeline/figure-grade-overrides.json` entry as published
 *     ground truth, regardless of checkcrops' verdict — `rejectedCropFiles`
 *     already encodes this.
 *
 * A caption's own y is sometimes printed well away from its image (Figure 6.1's
 * caption sits at the top of Ch. 6 p.101 while its icon-legend crop is two
 * paragraphs lower — both hand-confirmed real). Strict containment alone
 * misses that case, so unresolved captions fall back to the nearest
 * still-unclaimed region on the same page: this only fires when nothing on the
 * page satisfies strict containment, so it cannot steal a region that some
 * other caption already legitimately claimed by position.
 *
 * BLIND SPOT — this oracle sees only "Figure N.M"-style captions, which appear
 * solely in the numbered chapters (Ch. 1–2 … Ch. 8). The Appendix and
 * umferdarmerki_enska documents caption nothing this way despite holding 52%
 * of all figure-style crop regions in the corpus, and 78 unnumbered crop
 * regions elsewhere (8 of them graded text-only) are equally invisible to it.
 * A green result here is not a coverage guarantee for those documents.
 */
interface FigureOccurrence {
  doc: string;
  scan: string;
  n: number;
  m: number;
  lineIdx: number;
  lineText: string;
  y: number;
  isCaption: boolean;
}

/** "Figure 3.38A" must match with the number, tolerating a trailing sub-panel
 *  letter — a plain trailing `\b` fails between two \w chars ("7" then "A"),
 *  which silently dropped Figure 3.38 out of the caption pool in an earlier
 *  pass. A negative digit lookahead instead of `\b` reproduces, on the current
 *  corpus, the exact same 131 distinct figure numbers as the phase-1 oracle's
 *  strict+fuzzy combination did — so the fuzzy OCR-confusable pass it also ran
 *  isn't needed for a deterministic regression check. */
const FIGURE_REF = /\bFig(?:ure)?\.?\s*(\d{1,2})\s*[.,]\s*(\d{1,3})(?!\d)/gi;

function figureNumberCoverage(): {
  published: number;
  missing: number;
  ambiguous: number;
  total: number;
  missingLabels: string[];
  ambiguousLabels: string[];
  staleAllowlist: string[];
} {
  const WORK = path.join(ROOT, 'build/work');
  const OCR = path.join(WORK, 'ocr');
  const figManifest: Record<string, FigureRegion[]> = JSON.parse(
    readFileSync(path.join(WORK, 'figures.json'), 'utf8'),
  );
  const cropQa: CropRow[] = JSON.parse(readFileSync(path.join(WORK, 'crop-qa.json'), 'utf8'));
  const qaByFile = new Map(cropQa.map((c) => [c.file, c]));
  const overridesPath = path.join(ROOT, 'pipeline/figure-grade-overrides.json');
  const overrideFiles = new Set<string>(
    existsSync(overridesPath)
      ? (JSON.parse(readFileSync(overridesPath, 'utf8')) as { file: string }[]).map((o) => o.file)
      : [],
  );
  const isRuleCrop = (c: CropRow) => Math.max(c.w / c.h, c.h / c.w) >= 6 && c.contentFrac < 0.12;
  /** true = confirmed non-picture, false = published (incl. override), undefined = no qa row. */
  const rejectedStatus = (file: string): boolean | undefined => {
    const qa = qaByFile.get(file);
    if (!qa) return undefined;
    if (overrideFiles.has(file)) return false;
    return qa.verdict === 'text-only' || qa.verdict === 'blank';
  };

  // `doc` here is the OCR page's own `.doc` field, which is already the file-stem
  // base ("Ch. 6"), not the site docid ("ch-6") — no OCR_BASE lookup needed.
  const ocrLines = new Map<string, OcrLine[]>();
  const linesFor = (doc: string, scan: string): OcrLine[] => {
    const key = `${doc}/${scan}`;
    if (ocrLines.has(key)) return ocrLines.get(key)!;
    const m = /^(\d+)([ab])$/.exec(scan);
    let lines: OcrLine[] = [];
    if (m) {
      const file = path.join(OCR, `${doc}-p${m[1]!.padStart(3, '0')}${m[2]}.json`);
      if (existsSync(file)) lines = (JSON.parse(readFileSync(file, 'utf8')) as OcrPage).lines;
    }
    ocrLines.set(key, lines);
    return lines;
  };

  const isContinuation = (o: FigureOccurrence): boolean => {
    const lines = linesFor(o.doc, o.scan);
    if (o.lineIdx <= 0 || o.lineIdx - 1 >= lines.length) return false;
    const prev = lines[o.lineIdx - 1]!.text.trim().toLowerCase();
    return prev.endsWith('(see') || prev.endsWith('(');
  };

  const occurrences: FigureOccurrence[] = [];
  for (const f of readdirSync(OCR).filter((n) => n.endsWith('.json'))) {
    const page: OcrPage = JSON.parse(readFileSync(path.join(OCR, f), 'utf8'));
    const scan = `${page.pdfPage}${page.side}`;
    page.lines.forEach((line, lineIdx) => {
      for (const m of line.text.matchAll(FIGURE_REF)) {
        occurrences.push({
          doc: page.doc, scan, n: Number(m[1]), m: Number(m[2]),
          lineIdx, lineText: line.text, y: line.y, isCaption: false,
        });
      }
    });
  }
  for (const o of occurrences) {
    const lt = o.lineText.trim();
    const idx = lt.toLowerCase().indexOf('figure') === -1 ? lt.toLowerCase().indexOf('fig.') : lt.toLowerCase().indexOf('figure');
    o.isCaption =
      !isContinuation(o) &&
      idx >= 0 &&
      idx <= 2 &&
      !lt.toLowerCase().startsWith('(see') &&
      !lt.toLowerCase().slice(0, 20).includes('see figure');
  }

  const MARGIN = 0.12;
  type Status = 'PUBLISHED' | 'MISSING' | 'AMBIGUOUS';
  const results = new Map<string, { doc: string; scan: string; status: Status }>();

  const byPage = new Map<string, Map<string, { n: number; m: number; y: number }>>();
  for (const o of occurrences) {
    if (!o.isCaption) continue;
    const pageKey = `${o.doc}/${o.scan}`;
    const numKey = `${o.n}.${o.m}`;
    const bucket = byPage.get(pageKey) ?? new Map();
    byPage.set(pageKey, bucket);
    const existing = bucket.get(numKey);
    if (!existing || o.y < existing.y) bucket.set(numKey, { n: o.n, m: o.m, y: o.y });
  }
  const refPages = new Map<string, Set<string>>();
  for (const o of occurrences) {
    if (o.isCaption) continue;
    const numKey = `${o.n}.${o.m}`;
    const set = refPages.get(numKey) ?? new Set<string>();
    set.add(`${o.doc}/${o.scan}`);
    refPages.set(numKey, set);
  }

  for (const [pageKey, nums] of byPage) {
    const [doc, scan] = pageKey.split('/') as [string, string];
    const m = /^(\d+)([ab])$/.exec(scan)!;
    const figKey = `${doc}-p${m[1]!.padStart(3, '0')}${m[2]}`;
    const regions = (figManifest[figKey] ?? []).filter((r) => {
      const qa = qaByFile.get(r.file);
      return !(qa && isRuleCrop(qa));
    });
    const regInfo = regions.map((r) => ({ file: r.file, y: r.y, h: r.h, rejected: rejectedStatus(r.file) }));

    const sorted = [...nums.values()].sort((a, b) => a.y - b.y);
    const everClaimed = new Set<string>();
    const rows: { key: string; y: number; status: Status | null }[] = [];
    for (const num of sorted) {
      const key = `${num.n}.${num.m}`;
      const containing = regInfo.filter((r) => r.y - MARGIN <= num.y && num.y <= r.y + r.h + MARGIN);
      const survivor = containing.find((r) => r.rejected === false);
      const rejectHit = containing.find((r) => r.rejected === true);
      const unknownHit = containing.find((r) => r.rejected === undefined);
      let status: Status | null = null;
      if (survivor) { status = 'PUBLISHED'; everClaimed.add(survivor.file); }
      else if (rejectHit) { status = 'MISSING'; everClaimed.add(rejectHit.file); }
      else if (unknownHit) { status = 'AMBIGUOUS'; everClaimed.add(unknownHit.file); }
      rows.push({ key, y: num.y, status });
    }
    const unclaimed = regInfo.filter((r) => !everClaimed.has(r.file));
    for (const row of rows) {
      if (row.status !== null) continue;
      const cand = [...unclaimed].sort((a, b) => Math.abs(a.y - row.y) - Math.abs(b.y - row.y));
      const pub = cand.find((r) => r.rejected === false);
      const rej = cand.find((r) => r.rejected === true);
      const unk = cand.find((r) => r.rejected === undefined);
      if (pub) { row.status = 'PUBLISHED'; unclaimed.splice(unclaimed.indexOf(pub), 1); }
      else if (rej) { row.status = 'MISSING'; unclaimed.splice(unclaimed.indexOf(rej), 1); }
      else if (unk) { row.status = 'AMBIGUOUS'; unclaimed.splice(unclaimed.indexOf(unk), 1); }
      else row.status = 'MISSING';
    }
    for (const row of rows) results.set(row.key, { doc, scan, status: row.status! });
  }
  for (const [key, pages] of refPages) {
    if (!results.has(key)) {
      const [doc, scan] = [...pages][0]!.split('/') as [string, string];
      results.set(key, { doc, scan, status: 'AMBIGUOUS' });
    }
  }

  // Referenced-but-never-captioned figures this oracle cannot adjudicate
  // without opening the scan by hand (see the task write-up for 3.1/3.2/7.4):
  // allowlisted explicitly rather than silently excluded from the denominator.
  const AMBIGUOUS_ALLOWLIST = new Set(['3.1', '3.2', '7.4']);
  const staleAllowlist = [...AMBIGUOUS_ALLOWLIST].filter((label) => results.get(label)?.status !== 'AMBIGUOUS');

  const missingLabels = [...results].filter(([, r]) => r.status === 'MISSING').map(([k]) => k);
  const ambiguousLabels = [...results].filter(([, r]) => r.status === 'AMBIGUOUS').map(([k]) => k);
  const published = [...results.values()].filter((r) => r.status === 'PUBLISHED').length;

  return {
    published,
    missing: missingLabels.length,
    ambiguous: ambiguousLabels.length,
    total: results.size,
    missingLabels: missingLabels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    ambiguousLabels: ambiguousLabels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    staleAllowlist,
  };
}

/**
 * Does any published chunk mix text from two different frames of its page?
 *
 * Frames come from `frameCut` over the same line set `buildPage` feeds
 * `proseBlocks` — the same partition the build used, so this measures line
 * *reassembly*, not the cut itself. A line text that occurs in two frames of one
 * page is dropped rather than attributed to a guess.
 *
 * The three-word minimum does not make a hit meaningful, only cheaper: measured
 * over the current corpus, **10 of the 12 contaminated chunks are substring false
 * positives** — a short aside line whose text occurs verbatim inside the body
 * prose ("the braking distance." ch-4 12a, "from the left." appendix 1b,
 * "Roadworks and block marking" ch-3 6a, and seven more). Only 2 are real, both
 * the C5-r1 residual on appendix p-6b. So the share below is an upper bound with
 * a mostly-noise numerator; it still moves in the right direction under a real
 * regression, which is what the floor is for.
 *
 * Pages the sweep does not cut are not counted: a single frame cannot mix with
 * itself, and their chunks would only dilute the share.
 */
function framePurity(): { testable: number; contaminated: number; pages: number; examples: string[] } {
  const WORK = path.join(ROOT, 'build/work');
  const ds = JSON.parse(readFileSync(path.join(WORK, 'dataset.json'), 'utf8')) as {
    docs: { id: string; base: string }[];
    chunks: DatasetChunk[];
  };
  const figManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'figures.json'), 'utf8'));
  const signManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'signs.json'), 'utf8'));
  const rejected = rejectedCropFiles(WORK);
  const baseOf = new Map(ds.docs.map((d) => [d.id, d.base]));

  const cache = new Map<string, Map<string, number> | null>();
  const framesFor = (doc: string, scan: string): Map<string, number> | null => {
    const memo = `${doc}/${scan}`;
    if (cache.has(memo)) return cache.get(memo) ?? null;
    let index: Map<string, number> | null = null;
    const m = /^(\d+)([ab])$/.exec(scan);
    const base = baseOf.get(doc);
    if (m && base) {
      const key = `${base}-p${m[1]!.padStart(3, '0')}${m[2]}`;
      const file = path.join(WORK, 'ocr', `${key}.json`);
      if (existsSync(file)) {
        const page: OcrPage = JSON.parse(readFileSync(file, 'utf8'));
        const manifest = SIGN_PICTURE_DOCS.has(doc) ? signManifest : figManifest;
        const regions = (manifest[key] ?? []).filter((r) => !rejected.has(r.file));
        const frames = frameCut(pageBody(page, regions).body);
        if (frames.length > 1) {
          const owners = new Map<string, Set<number>>();
          frames.forEach((frame, i) => {
            for (const l of frame) {
              const t = reflow(l.text);
              if (t.split(' ').length < 3) continue;
              const seen = owners.get(t) ?? new Set<number>();
              seen.add(i);
              owners.set(t, seen);
            }
          });
          index = new Map(
            [...owners].filter(([, f]) => f.size === 1).map(([t, f]) => [t, [...f][0]!]),
          );
        }
      }
    }
    cache.set(memo, index);
    return index;
  };

  let testable = 0;
  let contaminated = 0;
  const pages = new Set<string>();
  const examples: string[] = [];
  for (const c of ds.chunks) {
    if (SIGN_LAYOUT_DOCS.has(c.doc)) continue;
    const index = framesFor(c.doc, c.src.scan);
    if (!index) continue;
    const text = reflow(c.text);
    const hit = new Set<number>();
    for (const [line, frame] of index) if (text.includes(line)) hit.add(frame);
    if (!hit.size) continue;
    testable++;
    pages.add(`${c.doc}/${c.src.scan}`);
    if (hit.size > 1) {
      contaminated++;
      if (examples.length < 5) examples.push(`${c.doc} p-${c.src.scan}: "${text.slice(0, 60)}…"`);
    }
  }
  return { testable, contaminated, pages: pages.size, examples };
}

// ─────────────────────────────────────────────────────────────────────────────
// Silent OCR omission
//
// Vision sometimes drops the tail of a line, or a whole line, and still reports
// conf 1.00 — so nothing downstream, and no confidence tint, can see it. The two
// signals below are the only ones this geometry supports: there are no word boxes
// in build/work/ocr (bookocr records the observation box only), and line-box
// height swings 1.87× within a single column, so every threshold here is in
// *characters* via a per-column characters-per-unit-width estimate (`cpc`, relative
// sd p50 5.8%) and `h` is used for nothing. Mid-line omission — full-width box,
// missing middle — leaves no signal at all and is not checked. Derivation,
// hand-verified instances and the sweeps behind every constant:
// build/qa/plan-ocr-omission.md §1/§6 and build/qa/validation-2026-08-05/dropped-words.md.

/**
 * Tail omissions accepted by hand, so the assertion below can be a hard one.
 *
 * Keyed by page and by the *published* line text, not by line index: a stale index
 * would silence a different line, whereas a stale text silences nothing.
 *
 * Emptied by the stage-1 `better()` fix (build/qa/plan-ocr-omission.md §3.1): both
 * entries here were `Ch. 6-p010b`'s two truncated tails ("only apply to material
 * objects," / "Comprehensive motor"), now read in full. An empty allowlist is the
 * regression test that the OCR merge fix worked — do not re-add an entry without
 * re-reading the scan first.
 */
const TAIL_OMISSION_ALLOWLIST: { key: string; text: string }[] = [];

interface OmissionScan {
  /** Pages carrying at least one analysable prose column. */
  pages: number;
  columns: number;
  /** Signal-1 denominator: interior lines that passed every gate. */
  population: number;
  p50: number;
  p90: number;
  p99: number;
  /** Signal-1 hits at or above the floor, allowlist removed. */
  hits: string[];
  /** Highest-scoring line not on the allowlist, whatever its score. */
  worst: string;
  worstRatio: number;
  allowlisted: number;
  staleAllowlist: string[];
  /** Signal-2 candidates, worst pitch first. Reviewed by hand, not asserted on. */
  queue: string[];
}

/**
 * One pass over build/work/ocr, clustering each page's observations into columns
 * and measuring two things per column:
 *
 *  1. tail omission — a mid-paragraph line is short for exactly one legitimate
 *     reason, that the next line's first word did not fit. So
 *     `ratio = shortfall_chars / (len(next first word) + 1)` can never be much
 *     above 1 unless glyphs Vision never reported were standing in that space.
 *  2. whole-line omission — a line Vision never observed leaves no short box, but
 *     it does leave a pitch hole of ~2 column leadings mid-sentence.
 */
function omissionScan(): OmissionScan {
  const WORK = path.join(ROOT, 'build/work');
  const OCR = path.join(WORK, 'ocr');
  const empty: OmissionScan = {
    pages: 0, columns: 0, population: 0, p50: 0, p90: 0, p99: 0,
    hits: [], worst: 'nothing measured', worstRatio: 0, allowlisted: 0,
    staleAllowlist: TAIL_OMISSION_ALLOWLIST.map((a) => `${a.key} "${a.text}"`), queue: [],
  };
  if (!existsSync(OCR)) return empty;

  const rejected = rejectedCropFiles(WORK);
  const figManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'figures.json'), 'utf8'));
  const signManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'signs.json'), 'utf8'));

  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  /** Ends the sentence, so a short box is legitimate. The single largest confounder. */
  const TERMINAL = /[.!?:;]["'”’)\]]?$/;
  const ENUMERATOR = /^\s*(?:[•·▪◦*‣]|[-–—]\s|\(?\d{1,2}[.)]|[a-z][.)])/;
  const DOTLEADER = /\.\s*\.\s*\./;
  const CONTINUES = /^\p{Ll}/u;

  const ratios: number[] = [];
  const scored: { ratio: number; where: string; key: string; text: string }[] = [];
  const queue: { pitch: number; line: string }[] = [];
  let columns = 0;
  let pages = 0;

  for (const f of readdirSync(OCR).filter((n) => n.endsWith('.json')).sort()) {
    const key = f.replace(/\.json$/, '');
    const page: OcrPage = JSON.parse(readFileSync(path.join(OCR, f), 'utf8'));
    const at = new Map<OcrLine, number>();
    page.lines.forEach((l, i) => at.set(l, i));
    const lines = page.lines.filter((l) => l.text.trim().length > 0);
    // Published figure boxes, for the wrap-around filter below.
    const regions = [...(figManifest[key] ?? []), ...(signManifest[key] ?? [])]
      .filter((r) => !rejected.has(r.file));

    // Columns first, then measures: an interleaved sidebar is its own column with
    // its own narrow measure, not a short body line — which is what keeps the
    // known interleaving defect from dominating this population. Single-linkage on
    // the left edge, gap 0.05 page widths. This is the most consequential cutoff in
    // the whole scan: swept 0.02 / 0.05 / 0.08 / 0.1 / 0.12, the population goes
    // 1,336 / 1,332 / 1,259 / 1,135 / 1,109 — a wider swing than the 0.02×measure
    // reference-tolerance sweep documented below, and it is what the ≥1,050
    // population floor actually rests on. No narrower gap was measured against
    // hand-verified columns, so 0.05 is not shown optimal, only in-range.
    const clusters: OcrLine[][] = [];
    for (const l of [...lines].sort((a, b) => a.x - b.x)) {
      const last = clusters[clusters.length - 1];
      if (last && l.x - last[last.length - 1]!.x <= 0.05) last.push(l);
      else clusters.push([l]);
    }

    let analysed = false;
    for (const cluster of clusters) {
      // Minimum lines to call a cluster a column, not a caption or a stray fragment.
      // Measured: sweeping 3–10 leaves the signal-1 population flat at 1,259 all the
      // way to 8; only at 10 do columns drop 184 → 180 and pages 168 → 166. Not
      // load-bearing for the population floor — it exists to keep tiny clusters out
      // of the column count, not to gate the ratio computation.
      if (cluster.length < 6) continue;
      const col = [...cluster].sort((a, b) => a.y - b.y);
      const colL = Math.min(...col.map((l) => l.x));
      const colR = Math.max(...col.map((l) => l.x + l.w));
      const measure = colR - colL;
      // Minimum column width, to exclude margin debris too narrow to be a real
      // measure. Measured: sweeping 0.06–0.2 moves population only 1,259 → 1,257 and
      // columns 185 → 183 — effectively inert over the whole plausible range.
      if (measure < 0.12) continue;
      // Characters per unit width, from this column's own full-measure lines. The
      // 0.02 × measure reference tolerance is the one free knob: sweeping it over
      // 0.01 / 0.02 / 0.03 / 0.05 moves the population 1,189–1,272 and the columns
      // 158–214, and leaves exactly 2 hits ≥ 2.0 and a highest non-allowlisted
      // 0.82 in all four. Estimator accuracy, against the one instance whose
      // dropped text was read off the scan: 26.5 characters predicted, 27 dropped.
      // The trailing `length >= 4` clause is not measured to matter and, re-checked
      // here, is completely inert: of 3,256 lines that reach within 0.02×measure of
      // the column's right edge, all 3,256 survive it — it has never once removed a
      // candidate on this corpus and is not in the original spec.
      const refs = col.filter((l) => colR - (l.x + l.w) <= 0.02 * measure && l.text.trim().length >= 4);
      // Minimum full-measure reference lines to trust the cpc estimate. Measured:
      // sweeping 1–5 moves population only 1,267 → 1,240 but columns much more,
      // 337 → 156 — this cutoff mostly trades away columns with too few reference
      // lines to estimate cpc safely, not the ratio population itself.
      if (refs.length < 3) continue;
      const cpc = median(refs.map((l) => l.w / l.text.trim().length));
      const leading = median(col.slice(1).map((l, i) => l.y - col[i]!.y));
      if (!(cpc > 0) || !(leading > 0)) continue;
      columns++;
      analysed = true;

      const reaches = (l: OcrLine, chars: number) => colR - (l.x + l.w) <= chars * cpc;
      const flushLeft = (l: OcrLine, chars: number) => Math.abs(l.x - colL) <= chars * cpc;

      for (let i = 0; i < col.length - 1; i++) {
        const a = col[i]!, b = col[i + 1]!;
        const pitch = (b.y - a.y) / leading;
        // An ordinary paragraph break is also ≈2 leadings and is the dominant
        // confounder, so the text must continue mid-sentence across the hole.
        // Flush-left tolerance 3.0 characters: the candidate count sits on a
        // plateau of 8 at 3.0, 3.5 and 4.0, and drops one true positive
        // (Ch. 7-p002a, left edge 2.86 characters off the column) at 2.5.
        if (pitch < 1.6 || pitch > 3.6) continue;
        if (!reaches(a, 2) || !reaches(b, 2) || !flushLeft(a, 3.0) || !flushLeft(b, 3.0)) continue;
        if (TERMINAL.test(a.text.trim()) || !CONTINUES.test(b.text.trim())) continue;
        queue.push({
          pitch,
          line: `${pitch.toFixed(2)} ${key} L${at.get(a)}→L${at.get(b)}: "…${a.text.trim().slice(-30)}" ⟶ "${b.text.trim().slice(0, 30)}…"`,
        });
      }

      // First and last line of a column are excluded: both neighbours are needed
      // to establish that the paragraph really continues past this line.
      for (let i = 1; i < col.length - 1; i++) {
        const line = col[i]!, prev = col[i - 1]!, next = col[i + 1]!;
        const right = line.x + line.w;
        const shortfall = colR - right;
        if (shortfall <= 0) continue;
        const text = line.text.trim();
        if (TERMINAL.test(text) || ENUMERATOR.test(text) || DOTLEADER.test(text)) continue;
        if (!reaches(prev, 2) || !reaches(next, 2) || !flushLeft(next, 2)) continue;
        const pitch = (next.y - line.y) / leading;
        // Restricts this signal to a single ordinary line-to-line pitch, so a real
        // paragraph break (≈2 leadings, handled separately above) isn't mistaken for
        // a short interior line. Measured: sweeping the band from [0.4, 1.6] out to
        // [0.7, 1.3] moves the population 1,265 → 1,211 — a moderate, roughly linear
        // narrowing, not a cliff. No hand-verified boundary case pins the edges more
        // precisely than that; 0.55/1.45 is in-range, not shown optimal.
        if (pitch < 0.55 || pitch > 1.45) continue;
        const nextText = next.text.trim();
        // Load-bearing and it costs recall: this blinds the check to an omission
        // ending exactly where a sentence ended, but without it the population is
        // dominated by section headings (relaxed, p99 goes 0.54 → 4.09).
        if (!CONTINUES.test(nextText)) continue;
        // Meant to catch Vision splitting one typeset line into two observations
        // (the 1-character tolerance is not cosmetic: at `o.x >= right` exactly, the
        // two fragments of Ch. 7-p008b L18/L19 miss each other by 1e-4 page units and
        // L19 scores 6.79, top of the population and a false positive). Measured
        // against what it actually rejects, though, this gate mostly does something
        // else: of its 116 rejections only 9 are true same-line fragments; the other
        // 107 are lines whose right-hand neighbour is a *different block* — a
        // sidebar, a legend, a second column — sitting at the same height, not a
        // continuation of this line at all. So on sidebar-heavy pages it has
        // near-zero recall for the split case it was written for. Left in place
        // anyway: every one of its false-negative costs is a real candidate quietly
        // dropped from the population, never a fabricated hit, and a missing card
        // beats a wrong card here too.
        const split = page.lines.some((o) => {
          if (o === line) return false;
          const overlap = Math.min(line.y + line.h, o.y + o.h) - Math.max(line.y, o.y);
          return overlap / Math.min(line.h, o.h) >= 0.45 && o.x >= right - cpc;
        });
        if (split) continue;
        // Text wrapping around an inset figure is legitimately short. Only a box
        // whose left edge is inside this column counts, and only from 6 characters
        // of intrusion: crop boxes carry a generous margin, and the looser reading —
        // any y-overlapping box reaching within 6 characters of the measure — rejects
        // 358 of the 1,266 candidates that get this far, a quarter of the population,
        // for no gain (same two hits, same max). Read as written it rejects 7. The
        // 6-character floor is what recovers Ch. 6-p010b L38, whose figure box starts
        // 1.7 characters short of a measure of 0.6188.
        const wrapped = regions.some((r) => Math.min(line.y + line.h, r.y + r.h) > Math.max(line.y, r.y)
          && r.x > colL && colR - r.x >= 6 * cpc);
        if (wrapped) continue;
        const firstWord = nextText.split(/\s+/)[0] ?? '';
        const ratio = (shortfall / cpc) / (firstWord.length + 1);
        ratios.push(ratio);
        scored.push({
          ratio,
          key,
          text,
          where: `${ratio.toFixed(2)} ${key} L${at.get(line)}: "…${text.slice(-34)}" ⟶ "${nextText.slice(0, 26)}…" (${(shortfall / cpc).toFixed(0)} characters unaccounted for)`,
        });
      }
    }
    if (analysed) pages++;
  }

  const sorted = [...ratios].sort((a, b) => a - b);
  const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! : 0);
  const ranked = [...scored].sort((a, b) => b.ratio - a.ratio);
  const matched = new Set<number>();
  const allowed = (h: { key: string; text: string }) => {
    const i = TAIL_OMISSION_ALLOWLIST.findIndex((a) => a.key === h.key && a.text === h.text);
    if (i < 0) return false;
    matched.add(i);
    return true;
  };
  const open = ranked.filter((h) => !allowed(h));
  return {
    pages,
    columns,
    population: sorted.length,
    p50: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    hits: open.filter((h) => h.ratio >= 2.0).map((h) => h.where),
    worst: open[0]?.where ?? 'nothing measured',
    worstRatio: open[0]?.ratio ?? 0,
    allowlisted: matched.size,
    staleAllowlist: TAIL_OMISSION_ALLOWLIST
      .filter((_, i) => !matched.has(i))
      .map((a) => `${a.key} "${a.text}"`),
    queue: queue.sort((a, b) => b.pitch - a.pitch).map((q) => q.line),
  };
}

/** Longest published figure caption, in words, and the page it is on. */
function longestFigcaption(): { words: number; where: string; total: number } {
  let words = 0;
  let where = '';
  let total = 0;
  for (const f of readdirSync(SITE).filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(path.join(SITE, f), 'utf8');
    let page = '?';
    for (const m of html.matchAll(/<section class="page" id="(p-[0-9ab]+)"|<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)) {
      if (m[1]) {
        page = m[1];
        continue;
      }
      total++;
      const text = m[2]!.replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const n = text.split(/\s+/).filter(Boolean).length;
      if (n > words) {
        words = n;
        where = `${f.replace(/\.html$/, '')} ${page}`;
      }
    }
  }
  return { words, where, total };
}

async function run() {
  if (!existsSync(SITE)) throw new Error('site/ missing — run npm run build:html first');
  const { server, base } = await serve(SITE);
  const browser: Browser = await chromium.launch();
  const lex = loadLexicon();
  console.log(`lexicon: ${lex.size.toLocaleString('en-US')} words\n`);

  const docText = new Map<string, string>();

  // ── 1. Rendering, on a phone and a desktop viewport ────────────────────────
  for (const [vpName, viewport] of [
    ['iPhone 14 (390×844)', { width: 390, height: 844 }],
    ['desktop (1280×900)', { width: 1280, height: 900 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    for (const slug of ['index', 'qa', ...DOC_SLUGS]) {
      const errors: string[] = [];
      const failedReqs: string[] = [];
      const onConsole = (m: ConsoleMessage) => {
        if (m.type() === 'error') errors.push(m.text());
      };
      page.on('console', onConsole);
      page.on('requestfailed', (r) => failedReqs.push(r.url()));
      page.on('response', (r) => {
        if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`);
      });

      const resp = await page.goto(`${base}/${slug}.html`, { waitUntil: 'load' });
      check(`[${vpName}] ${slug}: HTTP 200`, resp?.status() === 200, `got ${resp?.status()}`);

      // Force lazy images in view so their requests actually fire.
      await page.evaluate(async () => {
        for (const img of Array.from(document.querySelectorAll('img'))) img.loading = 'eager';
        await new Promise((r) => setTimeout(r, 50));
      });
      await page.waitForLoadState('networkidle');

      const metrics = await page.evaluate(() => {
        const de = document.documentElement;
        // Find any element whose box extends past the viewport.
        let worst = { sel: '', right: 0 };
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.right > worst.right) {
            worst = { sel: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''), right: r.right };
          }
        }
        const imgs = Array.from(document.images);
        return {
          scrollW: de.scrollWidth,
          clientW: de.clientWidth,
          worst,
          textLen: (document.body.innerText || '').length,
          imgTotal: imgs.length,
          imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
          text: document.body.innerText || '',
        };
      });

      check(`[${vpName}] ${slug}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
      check(`[${vpName}] ${slug}: no failed requests`, failedReqs.length === 0, failedReqs.slice(0, 3).join(' | '));
      check(
        `[${vpName}] ${slug}: no horizontal overflow`,
        metrics.scrollW <= metrics.clientW + 1,
        `scrollWidth ${metrics.scrollW} > clientWidth ${metrics.clientW}, widest ${metrics.worst.sel} @${Math.round(metrics.worst.right)}px`,
      );
      check(`[${vpName}] ${slug}: no broken images`, metrics.imgBroken === 0, `${metrics.imgBroken}/${metrics.imgTotal} broken`);
      check(`[${vpName}] ${slug}: has text`, metrics.textLen > 400, `only ${metrics.textLen} chars`);

      if (vpName.startsWith('iPhone') && slug !== 'index' && slug !== 'qa') {
        docText.set(slug, metrics.text);
      }

      page.removeListener('console', onConsole);
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');
    }
    await ctx.close();
  }

  // ── 2. Transcription accuracy ─────────────────────────────────────────────
  console.log('— ground-truth passages —');
  for (const gt of [...GROUND_TRUTH, ...GROUND_TRUTH_EXTRA]) {
    const body = norm(docText.get(gt.doc) ?? '');
    const ok = body.includes(norm(gt.text));
    check(`ground truth [${gt.doc}] ${gt.label}`, ok, ok ? '' : `not found: "${gt.text.slice(0, 60)}…"`);
    console.log(`  ${ok ? '✓' : '✗'} ${gt.doc}: ${gt.label}`);
  }

  const toc = norm(docText.get('ch-1-2') ?? '');
  const missingNums = TOC_PAGE_NUMBERS.filter((n) => !toc.includes(n));
  check(
    'contents page-number column preserved (gutter split)',
    missingNums.length === 0,
    `missing ${missingNums.join(', ')}`,
  );

  // ── Contents folios and ordered-list numbering ────────────────────────────
  // Neither of these could fail before: the contents block was not recognised at
  // all, so there were no folios to compare, and nothing looked at list numbers.
  console.log('\n— list and contents numbering —');
  const tocHtml = readFileSync(path.join(SITE, 'ch-1-2.html'), 'utf8');
  for (const [title, page] of TOC_FOLIOS) {
    const row = new RegExp(
      `<span class="toc-t">${title}</span><span class="toc-p">(\\d*)</span>`,
    ).exec(tocHtml);
    check(`contents: "${title}" → p. ${page}`, row?.[1] === page, `published ${row?.[1] ?? 'no such row'}`);
  }

  const folios = tocFolios();
  check('contents rows are recognised as a .toc block', folios.testable >= 75, `${folios.testable} testable rows`);
  const folioFrac = folios.testable ? folios.ok / folios.testable : 0;
  check(
    'contents folios name the page their section starts on ≥ 0.94',
    folioFrac >= 0.94,
    `${folios.ok}/${folios.testable} = ${(folioFrac * 100).toFixed(1)}%; misses: ${folios.miss.slice(0, 4).join(' | ')}`,
  );
  console.log(`  ${folioFrac >= 0.94 ? '✓' : '✗'} ${folios.ok}/${folios.testable} contents folios verified against the section's own page (${(folioFrac * 100).toFixed(1)}%)`);

  const ol = orderedListNumbering();
  check('ordered-list numbering was actually compared', ol.checked >= 60, `${ol.checked} items matched`);
  check(
    'every ordered-list item shows the number the book printed',
    ol.wrong.length === 0,
    `${ol.wrong.length} wrong: ${ol.wrong.slice(0, 4).join(' | ')}`,
  );
  console.log(`  ${ol.wrong.length === 0 ? '✓' : '✗'} ${ol.checked} ordered-list items matched to a printed enumerator, ${ol.wrong.length} numbered wrongly`);

  // Page furniture must not leak into prose.
  for (const slug of DOC_SLUGS) {
    const t = docText.get(slug) ?? '';
    // A running head duplicated into body text shows up as a caps run mid-sentence.
    const leaked = /[a-z]{3,} DRIVING IN ICELAND [a-z]{3,}/.test(t);
    check(`${slug}: running head not leaked into prose`, !leaked);
  }

  console.log('\n— lexicon coverage —');
  for (const slug of DOC_SLUGS) {
    const t = docText.get(slug) ?? '';
    const { frac, total, bad } = lexiconCoverage(t, lex);
    // Floors sit ~1 point under measured accuracy, so a real regression trips
    // them while normal OCR variation does not. The sign sheet is mostly terse
    // labels and Icelandic place names, hence the lower bar.
    const FLOORS: Record<string, number> = { 'umferdarmerki-enska': 0.88, appendix: 0.955 };
    const floor = FLOORS[slug] ?? 0.965;
    check(
      `${slug}: lexicon coverage ≥ ${floor}`,
      frac >= floor,
      `${(frac * 100).toFixed(1)}% of ${total} tokens; worst: ${bad.slice(0, 8).join(', ')}`,
    );
    console.log(`  ${frac >= floor ? '✓' : '✗'} ${slug}: ${(frac * 100).toFixed(1)}% of ${total.toLocaleString('en-US')} tokens`);
  }

  // ── 3. Structure ──────────────────────────────────────────────────────────
  console.log('\n— structure —');
  const qa: { doc: string; page: string; conf: number; chars: number; empty: boolean }[] = JSON.parse(
    readFileSync(path.join(ROOT, 'build/qa-report.json'), 'utf8'),
  );
  const nonEmpty = qa.filter((r) => !r.empty);
  check('all documents produced pages', nonEmpty.length >= 150, `${nonEmpty.length} non-empty pages`);
  const meanConf = nonEmpty.reduce((n, r) => n + r.conf, 0) / nonEmpty.length;
  check('mean OCR confidence ≥ 0.93', meanConf >= 0.93, `${meanConf.toFixed(3)}`);
  const weak = nonEmpty.filter((r) => r.conf < 0.6);
  check('few very-low-confidence pages', weak.length <= 4, `${weak.length}: ${weak.map((w) => `${w.doc} ${w.page}`).join(', ')}`);
  console.log(`  ${nonEmpty.length} pages, mean confidence ${(meanConf * 100).toFixed(1)}%, ${weak.length} below 60%`);

  // ── Column frames ─────────────────────────────────────────────────────────
  console.log('\n— column frames —');
  const purity = framePurity();
  const dirty = purity.testable ? purity.contaminated / purity.testable : 0;
  // An anti-vacuity guard, not a quality floor: the share below is meaningless
  // without a denominator, and a frame fix that stopped splitting pages, a
  // widened GAP_MIN or a renamed build/work/ocr key would all drive that
  // denominator to zero and turn the purity check green on 0/0.
  //
  // It asserts on *pages the sweep cuts*, not on testable chunks. Only
  // multi-frame pages contribute at all, so the page count fires directly on the
  // failure mode while being invariant to how the pipeline groups lines into
  // chunks. The chunk count is not: merging interleaved fragments into coherent
  // paragraphs necessarily shrinks it — measured 1,405 before the frame fix and
  // 1,276 after, with 2,074 → 1,944 chunks overall — so a chunk-count guard
  // reads a correct improvement as a regression. (That is why the guard this
  // replaced, `testable >= 1300`, was recalibrated rather than lowered: it was set
  // from the pre-fix 1,405 on the same day, and no correct frame fix could pass
  // it.) Measured 149 cut pages; 120 leaves margin for the handful a future stage
  // may re-partition. That 20% is wider than this suite's customary ~1 point, and
  // deliberately so: this is a count, not a rate, and any real loss of splitting
  // takes it toward zero rather than down by twenty.
  check(
    'frame purity measured over the whole corpus',
    purity.pages >= 120,
    `only ${purity.pages} cut pages (${purity.contaminated}/${purity.testable} testable chunks)`,
  );
  // Floor: this code measures 12/1,276 = 0.94% of testable chunks post-fix, so
  // 2.5% leaves well over the customary point of margin. Pre-fix it measured
  // 157/1,405 = 11.2% (the plan predicted 11.3%).
  check(
    'chunks mix text from at most one column frame (≤ 2.5%)',
    dirty <= 0.025,
    `${purity.contaminated}/${purity.testable} testable chunks = ${(dirty * 100).toFixed(1)}%`,
  );
  console.log(`  ${dirty <= 0.025 ? '✓' : '✗'} frame purity: ${purity.contaminated} of ${purity.testable} testable chunks contaminated (${(dirty * 100).toFixed(1)}%) over ${purity.pages} pages`);
  for (const e of purity.examples) console.log(`      ${e}`);

  const cap = longestFigcaption();
  // A caption that has absorbed the body column beside it runs to 172 words;
  // the longest genuine caption in the book is 45.
  check(
    'no figure caption exceeds 60 words',
    cap.words <= 60,
    `longest is ${cap.words} words on ${cap.where}`,
  );
  console.log(`  ${cap.words <= 60 ? '✓' : '✗'} longest of ${cap.total} figcaptions: ${cap.words} words (${cap.where})`);

  // ── OCR omission ──────────────────────────────────────────────────────────
  console.log('\n— OCR omission —');
  const om = omissionScan();
  // Anti-vacuity, the frame-purity lesson applied: `max(ratio) < 2.0` over an empty
  // population passes silently, and that population depends on a column model, on a
  // cpc estimator that needs ≥ 3 full-measure reference lines, and on the
  // build/work/ocr key format. Any of them breaking makes the assertion green and
  // useless, so two counts — never rates — are asserted beside it.
  //
  // Measured today: 1,259 gated interior lines over 184 prose columns of 168
  // assessable pages (188 files, 9,351 observations). The population is the more
  // estimator-sensitive of the two — 1,189–1,272 across the cpc reference tolerance
  // sweep, and relaxing any single 2-character gate moves it past 1,600 — hence the
  // wide margin. The column count is the one that cannot collapse quietly: it is
  // invariant to how many lines pass the gates, so it still fires if the ratio
  // computation itself breaks, and every fix in the OCR plan adds text to columns
  // rather than removing them (the mistake `testable >= 1300` made: a floor set from
  // a pre-fix denominator that no correct fix could satisfy).
  check(
    'tail-omission population measured over the corpus (≥ 1,050 lines)',
    om.population >= 1050,
    `only ${om.population} gated interior lines`,
  );
  check(
    'prose columns analysed (≥ 150)',
    om.columns >= 150,
    `only ${om.columns} columns over ${om.pages} pages`,
  );
  // The floor sits in an empty gap, measured from both sides: p50 0.10, p90 0.27,
  // p99 0.54, highest non-allowlisted value 0.82 (Ch. 8-p006b L8, read against the
  // scan and complete), then nothing until the two hand-verified omissions at 4.07
  // and 4.37. So 2.0 is 2.4× above the worst false positive this corpus contains and
  // 2.0× below the lower true positive; both bounds hold across all four cpc
  // tolerances swept. The audit's independent implementation put the same numbers at
  // 1.14 and 4.11/4.41 — a different estimator, same empty gap.
  check(
    'no silent tail omission (ratio < 2.0 outside the allowlist)',
    om.hits.length === 0,
    om.hits.join(' | '),
  );
  console.log(`  ${om.hits.length === 0 ? '✓' : '✗'} tail omission: ${om.population.toLocaleString('en-US')} interior lines, ${om.columns} columns, ${om.pages} pages — p50 ${om.p50.toFixed(2)}, p90 ${om.p90.toFixed(2)}, p99 ${om.p99.toFixed(2)}, worst outside allowlist ${om.worstRatio.toFixed(2)}, ${om.allowlisted} allowlisted`);
  console.log(`      worst: ${om.worst}`);
  for (const h of om.hits) console.log(`      HIT: ${h}`);
  for (const a of om.staleAllowlist) console.log(`      allowlist entry no longer matches any line — re-read the scan and drop it: ${a}`);
  // The regression test for whatever stage 1 turns out to be: TAIL_OMISSION_ALLOWLIST
  // exists only because those two lines are accepted, hand-verified omissions, not
  // because the detector is wrong about them. Once a fix makes them readable, the
  // allowlist keys (page + published text) stop matching any line and go stale —
  // and a stale entry is silent on its own; nothing else here fails just because an
  // allowlist got out of date. Asserting on it is what turns "someone remembered to
  // delete the two lines" into "the suite fails until they do."
  check(
    'tail-omission allowlist has no stale entries',
    om.staleAllowlist.length === 0,
    om.staleAllowlist.join(' | '),
  );
  // A bounded review queue, deliberately not an assertion on the pitch of any one
  // candidate: verified precision is 5 of 8 and the boundary is 1.64 true against
  // 1.62 false, so page tilt moves pitch by more than the class separation. The
  // ceiling sits at today's count rather than above it, because the whole value of
  // this check is that one more candidate forces a human to read the list — which
  // is printed in full for exactly that reason.
  //
  // Tightened 8 → 3 by the stage-3 third framing + containment dedup
  // (build/qa/plan-ocr-omission.md §3.3/§6.2): of the eight candidates that stage
  // 1+2 left, five were real omissions and are now resolved by the third framing
  // (including ch-6 p.101, the one this whole change exists for); the queue is
  // measured at exactly 1 survivor post-fix (`Ch. 5-p007a` L1→L3, the verified
  // page-tilt artefact the plan predicted would remain) — 3 keeps the ≤8 check's
  // original margin logic (room for one more candidate before a human must read
  // the list) rather than gating on the exact count observed today.
  check(
    'whole-line omission candidates stay a reviewable list (≤ 3)',
    om.queue.length <= 3,
    `${om.queue.length} candidates`,
  );
  console.log(`  ${om.queue.length <= 3 ? '✓' : '✗'} whole-line omission review queue: ${om.queue.length} candidates`);
  for (const q of om.queue) console.log(`      ${q}`);

  // Every cropped picture should carry the text printed with it. Floors are set
  // under the measured values so a regression in figure/caption pairing shows up.
  console.log('\n— picture labelling —');
  const COVERAGE_FLOORS: Record<string, number> = {
    'umferdarmerki-enska': 0.78,
    // Per-sign detection in the appendix tables yields far more crops than the
    // book prints descriptions for, so the achievable share is lower here.
    appendix: 0.28,
  };
  for (const slug of DOC_SLUGS) {
    const html = readFileSync(path.join(SITE, `${slug}.html`), 'utf8');
    const figs = [...html.matchAll(/<figure( class="nolabel")?>/g)];
    if (!figs.length) continue;
    const labelled = figs.filter((m) => !m[1]).length;
    const frac = labelled / figs.length;
    const floor = COVERAGE_FLOORS[slug] ?? 0.3;
    check(
      `${slug}: pictures paired with their text ≥ ${floor}`,
      frac >= floor,
      `${labelled}/${figs.length} = ${(frac * 100).toFixed(0)}%`,
    );
    console.log(`  ${frac >= floor ? '✓' : '✗'} ${slug}: ${labelled}/${figs.length} pictures labelled (${(frac * 100).toFixed(0)}%)`);
  }

  // Crop quality: nothing graded a non-picture may reach the page, and clipped
  // crops must stay rare and be visibly marked.
  console.log('\n— crop quality —');
  const qaPath = path.join(ROOT, 'build/work/crop-qa.json');
  if (existsSync(qaPath)) {
    const crops: { file: string; verdict: string }[] = JSON.parse(readFileSync(qaPath, 'utf8'));
    // Published filenames are slugified by the builder; match through the same
    // transform or nothing lines up and the check silently passes on zero rows.
    const slugify = (t: string) =>
      t.toLowerCase().replace(/[–—]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const verdictOf = new Map(crops.map((c) => [slugify(path.basename(c.file, '.png')), c.verdict]));
    // Hand-reviewed exceptions to checkcrops' text-only call (see
    // rejectedCropFiles above) are not "non-pictures" for this check either —
    // each was opened and confirmed by eye to be a real illustration.
    const overridesPath = path.join(ROOT, 'pipeline/figure-grade-overrides.json');
    const overriddenStems = new Set<string>(
      existsSync(overridesPath)
        ? (JSON.parse(readFileSync(overridesPath, 'utf8')) as { file: string }[]).map((o) =>
            slugify(path.basename(o.file, '.png')),
          )
        : [],
    );
    let published = 0;
    let badPublished: string[] = [];
    let flaggedCut = 0;
    let unflaggedCut = 0;
    for (const f of readdirSync(SITE).filter((n) => n.endsWith('.html'))) {
      const html = readFileSync(path.join(SITE, f), 'utf8');
      for (const m of html.matchAll(/<figure(?: class="([^"]*)")?>\s*<img src="([^"]+)"/g)) {
        const cls = m[1] ?? '';
        const stem = path.basename(m[2]!, '.jpg');
        const v = verdictOf.get(slugify(stem));
        if (v === undefined) continue;
        published++;
        if ((v === 'text-only' || v === 'blank') && !overriddenStems.has(slugify(stem))) badPublished.push(stem);
        if (v === 'cut') {
          flaggedCut++;
          if (!cls.includes('cropwarn')) unflaggedCut++;
        }
      }
    }
    check('crop grading actually matched published pictures', published > 100, `${published} matched`);
    check(
      'no text-only or blank crop is published as a picture',
      badPublished.length === 0,
      `${badPublished.length}: ${badPublished.slice(0, 4).join(', ')}`,
    );
    check('every clipped crop is marked in the page', unflaggedCut === 0, `${unflaggedCut} unmarked`);
    const cutShare = published ? flaggedCut / published : 0;
    check('clipped crops stay under 10% of published pictures', cutShare < 0.10, `${(cutShare * 100).toFixed(1)}%`);
    console.log(`  ${published} graded pictures published, ${badPublished.length} non-pictures, ${flaggedCut} clipped (${(cutShare * 100).toFixed(1)}%) all marked`);
  }

  // Numbered-figure coverage: every "Figure N.M" the book's own prose cites must
  // have a published crop. See figureNumberCoverage()'s doc comment for the
  // method, its three corrections, and the blind spot (Appendix and
  // umferdarmerki_enska caption nothing this way, so a green result here says
  // nothing about their coverage).
  console.log('\n— numbered-figure coverage —');
  const figCov = figureNumberCoverage();
  console.log(
    `  ${figCov.published}/${figCov.total} figure numbers published, ${figCov.missing} missing, ${figCov.ambiguous} ambiguous`,
  );
  if (figCov.missingLabels.length) console.log(`      missing: ${figCov.missingLabels.join(', ')}`);
  // Measured today: 122 published of 131 total (3 allowlisted ambiguous, 6
  // genuinely missing — 2 merged multi-figure crops (3.8/3.9, 3.33/3.34/3.35)
  // this project refused to rescue rather than publish a wrong crop, plus 4.42,
  // whose page has no crop region at all — see HANDOVER.md). Floor sits 1 below
  // the measured count per project convention, so it fails on any further
  // regression but doesn't demand the pre-existing gaps close.
  check(
    'every numbered figure the book cites has a published crop (≥ 121 of 131, ambiguous excluded)',
    figCov.published >= 121,
    `${figCov.published}/${figCov.total} published, missing: ${figCov.missingLabels.join(', ')}`,
  );
  // A silent allowlist is worse than no allowlist — assert every entry still
  // needs it, so a future fix that resolves one of these three is forced to
  // remove it rather than leave a stale exemption logging quietly.
  check(
    'ambiguous-figure allowlist has no stale entries',
    figCov.staleAllowlist.length === 0,
    figCov.staleAllowlist.join(', '),
  );

  // Every figure referenced by the HTML must exist on disk.
  let refs = 0;
  let missing = 0;
  for (const f of readdirSync(SITE).filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(path.join(SITE, f), 'utf8');
    for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      refs++;
      if (!existsSync(path.join(SITE, m[1]!))) missing++;
    }
  }
  check('every referenced image exists', missing === 0, `${missing} of ${refs} missing`);
  console.log(`  ${refs} image references, ${missing} missing`);

  await browser.close();
  server.close();

  // ── Report ────────────────────────────────────────────────────────────────
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
