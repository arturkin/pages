/**
 * Layout reconstruction: OCR lines + geometry → semantic blocks.
 *
 * Vision returns one observation per text line with a normalized bounding box
 * but no structure. Everything here is recovered from geometry: which column a
 * line belongs to, where paragraphs break, what is a heading, and which lines
 * are running heads or page numbers rather than body text.
 */

export interface OcrLine {
  text: string;
  conf: number;
  x: number;
  y: number;
  w: number;
  h: number;
  alts?: string[];
}

export interface OcrPage {
  doc: string;
  pdfPage: number;
  side: string;
  seq: number;
  imageFile: string;
  imageW: number;
  imageH: number;
  skewDeg: number;
  residualDeg: number;
  lines: OcrLine[];
  meanConf: number;
  lowConfCount: number;
}

export interface FigureRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  file: string;
  /** Mean colour saturation of the crop, from checkcrops. Only the sign sheet
   *  is printed in colour, so this separates its graphics from its black text. */
  chroma?: number;
}

export type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string; conf: number }
  | { kind: 'para'; text: string; conf: number }
  /** `start` carries the printed enumerator, so a numbered list split across
   *  several blocks by an interleaved column keeps the book's own numbering. */
  | { kind: 'list'; ordered: boolean; items: string[]; conf: number; start?: number }
  | { kind: 'toc'; entries: { text: string; page: string }[]; conf: number }
  | { kind: 'figure'; src: string; caption: string; w: number; shared?: boolean; group?: string }
  | { kind: 'caption'; text: string; conf: number }
  | { kind: 'question'; n: string; prompt: string; options: string[]; conf: number };

export interface PageDoc {
  seq: number;
  pdfPage: number;
  side: string;
  pageLabel: string | null;
  runningHead: string | null;
  blocks: Block[];
  meanConf: number;
  lowConfCount: number;
  lineCount: number;
  charCount: number;
  imageFile: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text cleanup

/**
 * Icelandic words and recurring proper nouns the English recognizer mangles.
 * Applied only as whole-token replacements so ordinary English is untouched.
 */
const TOKEN_FIXES: Record<string, string> = {
  OKUKENNSLA: 'ÖKUKENNSLA',
  ÖKUKENNSLA: 'ÖKUKENNSLA',
  OKUNAMSBOK: 'Ökunámsbók',
  'OKUNÁMSBOK': 'Ökunámsbók',
  'ÖKUNÁMSBOK': 'Ökunámsbók',
  Efingaakstur: 'Æfingaakstur',
  'AEfingaakstur': 'Æfingaakstur',
  Aefingaakstur: 'Æfingaakstur',
  Umferdarstofa: 'Umferðarstofa',
  Vegagerdin: 'Vegagerðin',
  Samgongustofa: 'Samgöngustofa',
  Reykjavik: 'Reykjavík',
  Islandi: 'Íslandi',
  Island: 'Ísland',
};

export function cleanText(s: string): string {
  let t = s
    // Collapse runs of whitespace introduced by wide letter spacing.
    .replace(/\s+/g, ' ')
    // Vision emits a lone low-quote for the Icelandic opening quote „.
    .replace(/[„]/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  t = t
    .split(' ')
    .map((word) => {
      const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const fix = TOKEN_FIXES[core];
      return fix ? word.replace(core, fix) : word;
    })
    .join(' ');

  // "DRIVING IN ICELAND" often loses the space between short words.
  t = t.replace(/\bIN ?ICELAND\b/g, 'IN ICELAND');
  return t;
}

/** Join two OCR lines of one paragraph, resolving end-of-line hyphenation. */
function joinLines(acc: string, next: string): string {
  if (!acc) return next;
  if (/[‐-―-]$/.test(acc) && /^[a-zà-ÿ]/.test(next)) {
    return acc.replace(/[‐-―-]$/, '') + next;
  }
  return `${acc} ${next}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Noise / furniture

const isPageNumber = (t: string) => /^\d{1,3}$/.test(t.trim());
const isRunningHead = (t: string) => {
  const s = t.trim();
  if (s.length < 4 || s.length > 40) return false;
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (!letters) return false;
  // Running heads in this book are set in caps.
  return letters === letters.toUpperCase() && letters.length >= 4;
};

/** Drop specks: tiny, low-confidence fragments with no word content. */
function isNoise(l: OcrLine): boolean {
  const t = l.text.trim();
  if (!t) return true;
  if (l.conf < 0.32 && t.length <= 2) return true;
  if (t.length <= 2 && !/[\p{L}\p{N}]/u.test(t)) return true;
  // A single stray character floating in a margin.
  if (t.length === 1 && l.conf < 0.5) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Column frames

interface Column {
  lines: OcrLine[];
  chars: number;
}

// Frame geometry.
//
// Thresholds, each with the distribution it came from, measured over the 175
// prose pages:
//
//  WIDE 0.60      the valley in the line-width distribution — 4,127 lines in
//                 0.50–0.60, 3 in 0.60–0.62, 41 at ≥ 0.62. The plan's sensitivity
//                 run reads 143 at 0.55, 142 at 0.58/0.60/0.62, 141 at 0.65, 139
//                 unfiltered — flat across the valley, which is the point; this
//                 code measures 145 two-frame pages at 0.60 over the same 175
//                 prose pages. It cannot be dropped: unfiltered, ch-6 p.107's
//                 full-width list alone contributes 7 straddlers. Note the
//                 distribution is a *whole-page* one and the value is applied
//                 unscaled in the recursed halves, where a half is ~0.5 wide, so
//                 the filter is inert there and CROSS_MAX governs alone: on the 5
//                 pages that emit more than 2 frames the widest line in any frame
//                 is 0.520. Immaterial in practice — only 8 of the 333 emitted
//                 frames contain a line over 0.60 at all, and none is a half.
//  LO 0.22        bound the sweep, not the emitted cut, which is clamped to them
//  HI 0.78        separately below. Every corridor centre a *whole page* yields
//                 lies in [0.347, 0.661], and widening the window from [0.30,0.70]
//                 to [0.22,0.78] changes no page's partition at all on its own
//                 (measured: 0 of 178 at VERTICAL_DEPTH 1). The width is for the
//                 recursed halves, whose corridors sit outside the old window:
//                 appendix p.165's place-name/description corridor centres at
//                 x 0.2751 and p.166's right half at 0.7214. It still excludes the
//                 page margins (the shipped 0.12 band walked into them) and, on the
//                 far side, the contents-page dot-leader gap at x 0.790–0.800. Those
//                 three pages take the tocBlocks path and never reach the sweep, but
//                 if they did their corridor centres are 0.8263 / 0.7813 / 0.7902
//                 (`Ch. 1–2-p001a` / `p001b` / `p002a`) and the clamp brings all
//                 three to exactly 0.7800 — 0.01 short of the gap, their partition
//                 unchanged. That 0.01 is the whole margin on this side: HI cannot be
//                 raised without re-measuring those pages.
//  GAP_MIN 0.004  corridor width at the accepted cut is continuous, not bimodal —
//                 <.006 ×3, .006–.008 ×2, .008–.010 ×3, .010–.012 ×4,
//                 .012–.014 ×5, .014–.018 ×17, .018–.025 ×36, ≥.025 ×73 — so it
//                 cannot carry the decision alone; every candidate in 0.004–0.015
//                 was read by eye and all are real marginal frames. 0.006 already
//                 loses ch-4 p.41, ch-4 p.68 and ch-5 p.76; 0.012 also loses
//                 ch-4 p.54, a known defect page.
//  CROSS_MAX 3    two-frame pages by straddle tolerance: 0→130, 1→137, 2→142,
//                 3→145, 4→147, 5→148. Every frame admitted up to 3 was verified
//                 by reading it; the first false positive (ch-3 p.20) appears at 5.
//  MIN_LINES 2    the smallest legitimate marginal frame in the corpus is
//  MIN_CHARS 15   ch-8 p.150's two-line caption (`Figure 8.6` + `Stopping a
//                 bleeding from an artery.`, 45 chars). Together these exclude
//                 single-line page furniture and 2-line runs like `• 87 ⏐ 2`.
const WIDE = 0.60, LO = 0.22, HI = 0.78, STEP = 0.0005;
const CROSS_MAX = 3, GAP_MIN = 0.004, MIN_LINES = 2, MIN_CHARS = 15;

/** §3.4: a band corridor must exceed this multiple of the page's median line
 *  pitch and carry this many lines on each side. Measured here: exactly one page
 *  takes this path, `Appendix-p008b` (appendix p.169), and it yields 4 frames.
 *  §3.4 claims two such pages; the second, `Ch. 3-p006b`, never reaches the band
 *  split because its whole-page vertical cut succeeds (cross 3, gap 0.0217) and
 *  both frames come out clean. */
const BAND_PITCH = 1.8, BAND_MIN_LINES = 6;

/**
 * The page's frames in reading order: left to right within a horizontal band,
 * top band before bottom band.
 *
 * A vertical cut, found by an exact sweep with a straddle tolerance, and each half
 * swept once more (`VERTICAL_DEPTH`) — the appendix's sign tables are three and
 * four frames, not two; then, only if the vertical cut fails altogether, one
 * horizontal band split whose bands are cut vertically in turn. A page with no
 * accepted cut is one frame holding every input line.
 */
export function frameCut(lines: OcrLine[]): OcrLine[][] {
  if (!lines.length) return [];
  return verticalFrames(lines, VERTICAL_DEPTH) ?? bandFrames(lines) ?? [lines];
}

/** Levels of vertical cut: the page, then each half once. §3.4's band split keeps
 *  its own single level — its bands are swept at depth 1, unchanged.
 *
 *  Measured over the 178 pages `buildPage` handles: depth 2 moves 4 pages from
 *  2 frames to 3 — appendix p.160/165/166 (`p004a`/`p006b`/`p007a`, sign faces
 *  lifted out of the description column) and ch-6 p.106 (`p006a`, the two label
 *  columns of Figures 6.10/6.11). No page loses a frame and the one-frame count is
 *  unchanged at 29, so the recursion never invents a split on a page the top-level
 *  sweep declined. Frames per page over the 175 prose pages:
 *  {1:29, 2:145, 4:1} at depth 1 → {1:29, 2:141, 3:4, 4:1} at depth 2. Depth 3 is
 *  not taken: measured, it changes no partition at all (0 of 178), because the
 *  surviving interleave — appendix p.165's right half — is a line *ordering*
 *  problem inside one frame, not another corridor. */
const VERTICAL_DEPTH = 2;

function verticalFrames(lines: OcrLine[], depth = 1): OcrLine[][] | null {
  const narrow = lines.filter((l) => l.w <= WIDE);
  let best: { cut: number; cross: number; gap: number } | null = null;
  const steps = Math.round((HI - LO) / STEP);
  for (let i = 0; i <= steps; i++) {
    const x = LO + i * STEP;
    let cross = 0, nl = 0, nr = 0, cl = 0, cr = 0;
    let gl = -1, gr = 2;
    for (const l of narrow) {
      const r = l.x + l.w;
      if (l.x < x && r > x) {
        cross++;
      } else if (r <= x) {
        nl++;
        cl += l.text.length;
        if (r > gl) gl = r;
      } else {
        nr++;
        cr += l.text.length;
        if (l.x < gr) gr = l.x;
      }
    }
    if (cross > CROSS_MAX) continue;
    if (Math.min(nl, nr) < MIN_LINES || Math.min(cl, cr) < MIN_CHARS) continue;
    const gap = gr - gl;
    if (gap < GAP_MIN) continue;
    // Cut at the corridor centre, not at the swept x: every x inside one corridor
    // scores identically, so the centre is the only choice that does not depend
    // on which end of the corridor the sweep reached first. Clamped back into the
    // sweep band because a corridor may extend past it: measured, the unclamped
    // centre reaches 0.8263 on `Ch. 1–2-p001a`, past the contents-page dot-leader
    // gap at 0.790–0.800 that LO/HI exist to exclude. The clamp cannot merge the
    // frames — if the centre exceeds HI then gr > HI ≥ x > gl, so HI is strictly
    // inside the corridor and still separates the same two sides.
    const cut = Math.min(HI, Math.max(LO, (gl + gr) / 2));
    if (!best || cross < best.cross || (cross === best.cross && gap > best.gap)) {
      best = { cut, cross, gap };
    }
  }
  if (!best) return null;

  // Straddlers and full-width lines land where their midpoint falls — the same
  // reattachment-by-overlap the shipped code does for wide lines.
  const left: OcrLine[] = [];
  const right: OcrLine[] = [];
  for (const l of lines) (l.x + l.w / 2 < best.cut ? left : right).push(l);
  // Defensive, and currently unreachable: the clamp keeps `cut` strictly inside
  // the corridor [gl, gr], so the ≥ MIN_LINES lines counted on each side of the
  // sweep still land on their own side here. Kept because it is what makes the
  // recursion below safe to express without re-deriving that argument.
  if (!left.length || !right.length) return null;
  if (depth <= 1) return [left, right];
  // Each half is swept again in page coordinates, not renormalised ones: a
  // candidate x outside the half's own extent leaves one side empty and the
  // MIN_LINES / MIN_CHARS gates reject it, so the window needs no rescaling.
  return [
    ...(verticalFrames(left, depth - 1) ?? [left]),
    ...(verticalFrames(right, depth - 1) ?? [right]),
  ];
}

function bandFrames(lines: OcrLine[]): OcrLine[][] | null {
  const byY = [...lines].sort((a, b) => a.y - b.y);
  const pitches: number[] = [];
  for (let i = 1; i < byY.length; i++) pitches.push(byY[i]!.y - byY[i - 1]!.y);
  const pitch = median(pitches);
  if (!(pitch > 0)) return null;

  let best: { y: number; gap: number } | null = null;
  for (const cand of lines) {
    const y = cand.y + cand.h;
    let above = 0, below = 0, crossed = false;
    let top = -1, bottom = 2;
    for (const l of lines) {
      const b = l.y + l.h;
      if (l.y < y && b > y) {
        crossed = true;
        break;
      }
      if (b <= y) {
        above++;
        if (b > top) top = b;
      } else {
        below++;
        if (l.y < bottom) bottom = l.y;
      }
    }
    if (crossed) continue;
    if (above < BAND_MIN_LINES || below < BAND_MIN_LINES) continue;
    const gap = bottom - top;
    if (gap <= BAND_PITCH * pitch) continue;
    if (!best || gap > best.gap) best = { y, gap };
  }
  if (!best) return null;

  const cut = best.y;
  // Both are non-empty for the same reason the vertical split's guard never
  // fires: BAND_MIN_LINES was counted on each side of this exact `y`.
  const upper = lines.filter((l) => l.y + l.h <= cut);
  const lower = lines.filter((l) => l.y + l.h > cut);
  const uf = verticalFrames(upper);
  const lf = verticalFrames(lower);
  // A band split is never emitted for its own sake — paragraph breaks are
  // paragraphize's job.
  if (!uf && !lf) return null;
  return [...(uf ?? [upper]), ...(lf ?? [lower])];
}

// Same-baseline fragments, ordered by x.
//
// Sorting a frame by `y` alone leaves the fragments of one typeset line in
// whatever order Vision reported them: ch-4 p.54's caption comes out
// `driver And the lane. driving` for `driving lane. And the driver`.
//
// The relation is deliberately **pairwise, not transitive** — a run's members
// must all share a baseline with each other, not merely with a neighbour.
// Measured alternatives, over the same corpus: chaining on `Δy < 0.5·h` finds
// 411 runs and mis-orders 285 across 81 pages (`Dangerous junctions with
// priority. Road / users from side roads…` comes out back to front), and
// chaining on overlap ≥ 0.5·min(h) still wrecks the appendix sign tables. The
// rule below finds 62 runs and re-orders 32, on 21 pages, every one read by eye.
//
// Known limit: where two runs' index ranges interleave, emission by first-member
// order can put them out of `y` order. Three live instances corpus-wide
// (`Ch. 6-p001b`, `Ch. 6-p011a`, `Ch. 7-p006a`), all on pages where Vision emitted
// overlapping line boxes and the text is already visibly scrambled; no fact or
// card is affected, so it is left alone.
//
//  FRAG_V_OVERLAP 0.75  of the shorter box's height — one baseline, not two.
//                       Measured over every pair the two x tests already admit:
//                       the accepted population runs 0.7500–1.0000 (0.75 is its
//                       floor, `Ch. 5-p011b`'s `Rear fog beam indicator…` / `0$`)
//                       and the 61 pairs this test rejects reach only 0.7362
//                       (`Appendix-p008b`, `frequently happen.` / `SLYSASVEDI`,
//                       correctly left alone), so the cut sits inside an empty
//                       band. It is not a clean separator, and cannot be made
//                       one: `Appendix-p008b`'s `directions.` / `BREID GONG` at
//                       0.7515 is a false positive that lands mid-sentence,
//                       while `Appendix-p010b`'s `Other road markings…` /
//                       `SVR STOP V` at 0.7775 is a true positive that repairs
//                       one — only a value in (0.7515, 0.7775] separates them,
//                       which is a hair drawn from a single example. The same
//                       construction one sign higher on that page
//                       (`for both directions.` / `EINBREID BRÚ`, 0.6531) is
//                       already rejected. See FIXES.md C5-r3.
//  FRAG_X_OVERLAP 0.012 the run's boxes must be side by side, but Vision's
//                       boxes are approximate: `Ch. 1–2-p005b`'s two fragments
//                       (`mental impairment, overexertion,` / `fatigue,
//                       alcohol`) overlap by 0.0044, so a 0.004 tolerance
//                       misses the one pair that page's defect consists of.
//  FRAG_X_GAP 0.03      of consecutive gap, pinned by `Appendix-p006b`: the
//                       sign-face place name `Gbr-Midbar` shares its baseline
//                       exactly (overlap 1.00 × min h) yet belongs to the sign,
//                       not to the sentence it interrupts, and stands 0.0457
//                       clear; `Kopavogur` (0.0129) and `200) Kirkjubelar-`
//                       (0.0207) do belong to the line beside them. At 0.05 the
//                       counts go to 114 runs / 73 re-ordered and `Gbr-Midbar`
//                       is spliced into the prose.
const FRAG_V_OVERLAP = 0.75, FRAG_X_OVERLAP = 0.012, FRAG_X_GAP = 0.03;

function sameBaselineOrder(byY: OcrLine[]): OcrLine[] {
  const sharesBaseline = (a: OcrLine, b: OcrLine): boolean => {
    const vo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (vo < FRAG_V_OVERLAP * Math.min(a.h, b.h)) return false;
    return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= FRAG_X_OVERLAP;
  };

  const n = byY.length;
  const claimed = new Array<boolean>(n).fill(false);
  /** first member in `y` order → the whole run in `x` order */
  const runAt = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (claimed[i]) continue;
    const set = [i];
    for (let j = i + 1; j < n; j++) {
      if (!claimed[j] && set.every((k) => sharesBaseline(byY[k]!, byY[j]!))) set.push(j);
    }
    if (set.length < 2) continue;
    set.sort((a, b) => byY[a]!.x - byY[b]!.x);

    let piece: number[] = [];
    const flush = () => {
      if (piece.length < 2) return;
      for (const k of piece) claimed[k] = true;
      runAt.set(Math.min(...piece), piece);
    };
    for (const k of set) {
      const prev = piece[piece.length - 1];
      if (prev !== undefined && byY[k]!.x - (byY[prev]!.x + byY[prev]!.w) > FRAG_X_GAP) {
        flush();
        piece = [];
      }
      piece.push(k);
    }
    flush();
  }
  if (!runAt.size) return byY;

  const emitted = new Array<boolean>(n).fill(false);
  const out: OcrLine[] = [];
  for (let i = 0; i < n; i++) {
    if (emitted[i]) continue;
    const run = runAt.get(i);
    for (const k of run ?? [i]) {
      emitted[k] = true;
      out.push(byY[k]!);
    }
  }
  return out;
}

function mkColumn(lines: OcrLine[]): Column {
  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  return { lines: sameBaselineOrder([...lines].sort((a, b) => a.y - b.y)), chars };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block assembly

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

const LIST_RE = /^(\d{1,2})[.)]\s+/;
const BULLET_RE = /^[•▪◦*•▪-]\s+/;
const FIGURE_RE = /^Figure\s*\d+[.,]\s*\d+/i;
/** TOC row: text, optional dot leaders, then a page number at the far right. */
const TOC_RE = /^(.+?)[\s.·]{2,}(\d{1,3})$/;

/** A checkbox in the practice tests: an empty glyph Vision reads inconsistently. */
const CHECKBOX_RE = /^[❑☐❏□⬜❑❏□DOJQ0oa]\s+/;

interface Ctx {
  medH: number;
  bodyH: number;
}

/**
 * Does this read like a title rather than a slice of prose?
 *
 * Line height alone promotes plenty of ordinary sentences: a line that happens
 * to carry both tall capitals and descenders measures like display type, and a
 * paragraph cut by a column break contributes its tail as a short "heading" —
 * "who possess valid driving licenses have their licenses". Three cheap tests
 * catch nearly all of them without touching a real title, since every heading in
 * this book opens on a capital and none ends in a sentence mark.
 */
function looksLikeHeading(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^[\p{Ll}]/u.test(t)) return false;
  if (/[.,;:]$/.test(t)) return false;
  // A title is a phrase, not a sentence; more than nine words is prose.
  if (t.split(/\s+/).length > 9) return false;
  return true;
}

/** A block together with where it sat on the page, needed to pair figures with
 *  their captions and to interleave asides in reading order. */
interface Placed {
  block: Block;
  y: number;
  x: number;
  w: number;
}

function paragraphize(col: Column, ctx: Ctx): Placed[] {
  const blocks: Placed[] = [];
  const lines = col.lines;
  if (!lines.length) return blocks;

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push((lines[i]!.y) - (lines[i - 1]!.y + lines[i - 1]!.h));
  }
  const medGap = median(gaps.filter((g) => g > -0.005));
  const colLeft = median(lines.map((l) => l.x));
  // The column's measure: how wide a filled body line runs.
  const widths = [...lines.map((l) => l.w)].sort((a, b) => a - b);
  const measure = widths[Math.floor(widths.length * 0.9)] ?? 1;

  type Group = { lines: OcrLine[]; kind: 'text' | 'heading' };
  const groups: Group[] = [];

  // Which enumerators this column actually prints. A line whose number has a
  // neighbour here is a member of that sequence, whatever its type measures —
  // the four-step Red Cross procedure on p. 141 lost step 2 to an <h4> because
  // "2. To assess potential injuries" is short, capitalized and unpunctuated,
  // which is exactly the shape looksLikeHeading admits.
  const enumerators = new Set<number>();
  for (const l of lines) {
    const m = LIST_RE.exec(l.text);
    if (m) enumerators.add(Number(m[1]));
  }
  const continuesNumbering = (t: string): boolean => {
    const m = LIST_RE.exec(t);
    if (!m) return false;
    const n = Number(m[1]);
    return enumerators.has(n - 1) || enumerators.has(n + 1);
  };

  const isMarked = (t: string) => LIST_RE.test(t) || BULLET_RE.test(t);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const prev = lines[i - 1];
    // Height alone is not enough: on a photographed page a body line carrying
    // both tall capitals and descenders can be 1.5× a plain one, which would
    // turn prose into headings and split the paragraph around it. A line that
    // fills the column measure is set text, so only a short line — or one far
    // too tall to be body type at all — counts as a heading.
    const isHeading =
      l.h > ctx.bodyH * 1.6 &&
      l.text.trim().length <= 64 &&
      (l.w < measure * 0.85 || l.h > ctx.bodyH * 2.2) &&
      !continuesNumbering(l.text);

    let breakHere = !prev;
    if (prev) {
      const gap = l.y - (prev.y + prev.h);
      // Blank-line separation.
      if (gap > Math.max(medGap * 1.7, ctx.bodyH * 0.55)) breakHere = true;
      // First-line indent: this book indents the opening line of a paragraph.
      if (l.x > colLeft + 0.014) breakHere = true;
      // Structural markers always start their own line group.
      if (isMarked(l.text) || CHECKBOX_RE.test(l.text)) breakHere = true;
      if (FIGURE_RE.test(l.text)) breakHere = true;
      const last = groups[groups.length - 1];
      if (last && ((last.kind === 'heading') !== isHeading)) breakHere = true;
      // The lead-in for the *next* list sits flush with the bullets above it and
      // at the same line pitch, so neither the gap nor the indent test breaks it
      // off and it is appended to the last bullet instead. On p. 74 that turned
      // "A car may be stopped, but not parked:" into part of a bullet in the
      // stop-and-park prohibition list, so "On a bridge" published as a place
      // where stopping is prohibited — the opposite of what the book says.
      // Deliberately narrow: only inside a marked item, only an unmarked line
      // that opens a sentence and closes on a colon. Corpus-wide, 3 of 314
      // published list items end in a colon and all three swallowed a lead-in;
      // the 21 items that merely contain one are untouched.
      const owner = last?.lines[0];
      if (
        owner && isMarked(owner.text) && !isMarked(l.text) &&
        /:$/.test(l.text.trim()) && /^\p{Lu}/u.test(l.text.trim())
      ) breakHere = true;
    }

    if (breakHere) groups.push({ lines: [l], kind: isHeading ? 'heading' : 'text' });
    else groups[groups.length - 1]!.lines.push(l);
  }

  // Merge consecutive text groups back into list / TOC / question structures.
  let i = 0;
  while (i < groups.length) {
    const g = groups[i]!;
    const text = g.lines.map((l) => cleanText(l.text)).reduce(joinLines, '');
    const conf = Math.min(...g.lines.map((l) => l.conf));

    // A run of tall lines long enough to be prose is prose, whatever its
    // measured height.
    if (g.kind === 'heading' && g.lines.length <= 2 && text.length <= 78 && looksLikeHeading(text)) {
      const maxH = Math.max(...g.lines.map((l) => l.h));
      const level = maxH > ctx.bodyH * 2.6 ? 2 : maxH > ctx.bodyH * 1.95 ? 3 : 4;
      blocks.push({ ...place(g.lines), block: { kind: 'heading', level, text, conf } });
      i++;
      continue;
    }
    if (g.kind === 'heading') {
      blocks.push({ ...place(g.lines), block: { kind: 'para', text, conf } });
      i++;
      continue;
    }

    if (FIGURE_RE.test(text)) {
      blocks.push({ ...place(g.lines), block: { kind: 'caption', text, conf } });
      i++;
      continue;
    }

    // Run of TOC rows.
    if (TOC_RE.test(text)) {
      const entries: { text: string; page: string }[] = [];
      let j = i;
      while (j < groups.length) {
        const t = groups[j]!.lines.map((l) => cleanText(l.text)).reduce(joinLines, '');
        const m = TOC_RE.exec(t);
        if (groups[j]!.kind !== 'text' || !m) break;
        entries.push({ text: m[1]!.trim(), page: m[2]! });
        j++;
      }
      if (entries.length >= 2) {
        blocks.push({ ...place(groups.slice(i, j).flatMap((q) => q.lines)), block: { kind: 'toc', entries, conf } });
        i = j;
        continue;
      }
    }

    // Run of list items.
    const ordered = LIST_RE.test(text);
    if (ordered || BULLET_RE.test(text)) {
      // A marked line that closes on a colon introduces the list rather than
      // belonging to it — the sidebar on p. 11 numbers its box "1)" and then its
      // items 1–6, so publishing the lead-in as item 1 shifts all six.
      if (/:$/.test(text)) {
        blocks.push({ ...place(g.lines), block: { kind: 'para', text, conf } });
        i++;
        continue;
      }
      const items: string[] = [];
      let j = i;
      let minConf = 1;
      // Two independent lists can sit in one frame, each printed from its own
      // first enumerator: the two marginal callouts on p. 46 are both printed
      // "1)", and merged into one run the second republishes as 2. So a run ends
      // where the printed numbers stop counting up. This only declines to merge —
      // every emitted block still takes its start verbatim from its own first
      // item, so a lone enumerator (the Red Cross steps heading pp. 143 and 144)
      // keeps its printed number exactly as before.
      let prevNum = -1;
      while (j < groups.length) {
        const t = groups[j]!.lines.map((l) => cleanText(l.text)).reduce(joinLines, '');
        const isOrd = LIST_RE.test(t);
        const isBul = BULLET_RE.test(t);
        if (groups[j]!.kind !== 'text' || (ordered ? !isOrd : !isBul)) break;
        if (ordered) {
          const n = Number(LIST_RE.exec(t)![1]);
          if (prevNum >= 0 && n !== prevNum + 1) break;
          prevNum = n;
        }
        items.push(t.replace(ordered ? LIST_RE : BULLET_RE, '').trim());
        minConf = Math.min(minConf, ...groups[j]!.lines.map((l) => l.conf));
        j++;
      }
      if (items.length >= 1) {
        // Keep the printed enumerator. An interleaved column splits one numbered
        // list into several blocks — the 18-item dashboard legend on p. 97 lands
        // in seven — and each block would otherwise restart at 1, renumbering 15
        // of the 18 warning lights. Taken verbatim, never inferred: the two steps
        // of the Red Cross procedure that head pp. 143 and 144 are the only
        // enumerator on their page, so any "does this continue a run here?" test
        // would drop them and leave a first-aid sequence renumbered. The cost is
        // that a misread enumerator publishes a misread number ("4a." read as
        // "42." on the licence-card specimen, p. 8) — which is the same trade the
        // rest of the pipeline makes, and that page is tinted uncertain already.
        const first = ordered ? LIST_RE.exec(text) : null;
        const start = first ? Number(first[1]) : 1;
        blocks.push({
          ...place(groups.slice(i, j).flatMap((q) => q.lines)),
          block: { kind: 'list', ordered, items, conf: minConf, ...(start > 1 ? { start } : {}) },
        });
        i = j;
        continue;
      }
    }

    blocks.push({ ...place(g.lines), block: { kind: 'para', text, conf } });
    i++;
  }

  return blocks;
}

/** Bounding geometry of the lines a block was assembled from. */
function place(lines: OcrLine[]): { y: number; x: number; w: number } {
  const y = Math.min(...lines.map((l) => l.y));
  const x = Math.min(...lines.map((l) => l.x));
  const right = Math.max(...lines.map((l) => l.x + l.w));
  return { y, x, w: right - x };
}

// ─────────────────────────────────────────────────────────────────────────────
// Table of contents
//
// The contents pages set their folios in a column hard against the right margin,
// as the tail of a dot leader. Read as prose they do two kinds of damage. The
// whitespace corridor between entries and folios lies at x 0.790–0.800, off the
// right edge of the band the frame sweep searches, so no cut is emitted there and
// the numbers sort into the entry flow by y. leaderColumn intercepts these pages
// before proseBlocks for that reason, so the sweep never runs on them at all.
// And the folios do not sit level with their entries: the book
// was photographed lying open, so the far margin curls and drifts down by up to a
// full line. Sorting by y therefore bound every number to the *following* entry,
// and all ~60 published folios came out one page too low — the only place the
// edition asserted a plainly checkable falsehood.

/** A bare folio in the right margin; the leader's leading dot often joins it. */
const LEADER_NUM_RE = /^[.·]?(\d{1,3})\.?$/;

/** Chapter and appendix rows print their own folio inline, after a dash. */
const TOC_INLINE_RE = /^((?:Chapter|Appendix)\b.*?)\s*[—–-]\s*(\d{1,3})\.?$/i;

/**
 * Is this page a contents page, and if so which lines are its folio column?
 *
 * Detected, not assumed. Measured over all 188 pages: the three contents pages
 * carry 19–33 right-margin bare numbers, 41–48% of the page's lines, ascending
 * down the page 95–100% of the time. The two pages that come nearest are the
 * licence-category table on p. 10 (6 numbers, 11% of lines, 80% ascending) and
 * the road numbers printed on sign faces on p. 25 (5 numbers, 8%, 25%). No page
 * lies between the two groups on any of the three measures.
 */
function leaderColumn(body: OcrLine[]): OcrLine[] | null {
  const nums = body
    .filter((l) => l.x > 0.8 && LEADER_NUM_RE.test(l.text.trim()))
    .sort((a, b) => a.y - b.y);
  if (nums.length < 8 || nums.length < body.length * 0.25) return null;
  const values = nums.map((l) => Number(LEADER_NUM_RE.exec(l.text.trim())![1]));
  let ascending = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! >= values[i - 1]!) ascending++;
  return ascending / (values.length - 1) >= 0.85 ? nums : null;
}

/**
 * Bind each folio to the entry whose leader it terminates.
 *
 * The drift between the two columns is a property of the photograph, not of the
 * book, so it is measured per page rather than assumed: the shift taken is the
 * one that leaves every folio on a distinct entry at the smallest mean residual.
 * On the three contents pages it comes out 1.00, 0.00 and 1.20 line pitches — any
 * fixed constant mis-pairs at least one of them — with a residual of 0.0014–0.0020
 * of page height, about a tenth of a line, and no folio landing twice.
 */
function pairLeaders(entries: OcrLine[], nums: OcrLine[], pitch: number): Map<OcrLine, string> {
  let best: { dup: number; res: number; asg: number[] } | null = null;
  for (let k = -6; k <= 16; k++) {
    const shift = (k / 10) * pitch;
    const claimed = new Set<number>();
    const asg: number[] = [];
    let dup = 0;
    let res = 0;
    for (const n of nums) {
      const target = n.y - shift;
      let bi = 0;
      let bd = Infinity;
      entries.forEach((e, i) => {
        const d = Math.abs(e.y - target);
        if (d < bd) { bd = d; bi = i; }
      });
      if (claimed.has(bi)) dup++;
      else claimed.add(bi);
      res += bd;
      asg.push(bi);
    }
    if (!best || dup < best.dup || (dup === best.dup && res < best.res)) best = { dup, res, asg };
  }
  const folio = new Map<OcrLine, string>();
  best?.asg.forEach((ei, i) => {
    const entry = entries[ei];
    const m = LEADER_NUM_RE.exec(nums[i]!.text.trim());
    if (entry && m && !folio.has(entry)) folio.set(entry, m[1]!);
  });
  return folio;
}

function tocBlocks(body: OcrLine[], nums: OcrLine[], ctx: Ctx): Block[] {
  const inColumn = new Set(nums);
  const entries = body.filter((l) => !inColumn.has(l)).sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < entries.length; i++) gaps.push(entries[i]!.y - entries[i - 1]!.y);
  const pitch = median(gaps.filter((g) => g > 0.004 && g < 0.06));
  const folio = pairLeaders(entries, nums, pitch);

  const blocks: Block[] = [];
  let rows: { text: string; page: string }[] = [];
  let conf = 1;
  const flush = () => {
    if (rows.length >= 2) blocks.push({ kind: 'toc', entries: rows, conf });
    else for (const r of rows) blocks.push({ kind: 'para', text: [r.text, r.page].filter(Boolean).join(' '), conf });
    rows = [];
    conf = 1;
  };
  for (const l of entries) {
    let text = cleanText(l.text);
    let page = folio.get(l) ?? '';
    if (!page) {
      const m = TOC_INLINE_RE.exec(text);
      if (m) {
        text = m[1]!.trim();
        page = m[2]!;
      }
    }
    // The page's own display title ("Table of Contents") is not a row.
    if (!page && l.h > ctx.bodyH * 1.6 && looksLikeHeading(text)) {
      flush();
      blocks.push({ kind: 'heading', level: l.h > ctx.bodyH * 2.6 ? 2 : 3, text, conf: l.conf });
      continue;
    }
    rows.push({ text, page });
    conf = Math.min(conf, l.conf);
  }
  flush();
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page assembly

/**
 * Layout for the traffic-sign reference sheet: a grid of sign graphics, each
 * labelled underneath.
 *
 * Running this through the prose path produces nonsense, because reading a grid
 * in column order concatenates unrelated labels ("Height limit Width limit
 * Smallest interval"). Here each sign claims the caption lines sitting directly
 * beneath it, and whatever is left over is section furniture.
 */
/** Fraction of a region's area covered by the union of the text-line boxes. */
function textCoverage(r: FigureRegion, lines: OcrLine[]): number {
  const N = 24;
  let hit = 0;
  for (let i = 0; i < N; i++) {
    const px = r.x + ((i + 0.5) * r.w) / N;
    for (let j = 0; j < N; j++) {
      const py = r.y + ((j + 0.5) * r.h) / N;
      if (lines.some((l) => px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h)) hit++;
    }
  }
  return hit / (N * N);
}

/**
 * Two kinds of page furniture on the sign sheet get detected as signs, and both
 * do real damage. They publish as blank cards; they swallow the section heading
 * that classifies every sign beneath them; and — worst — a caption block that
 * poses as a sign consumes the caption of the sign it sits under, so every
 * pairing after it in the row shifts onto the wrong graphic.
 *
 * Measured over all 467 sign-sheet crops:
 *
 *  - The section bullet, a small blue glyph repeated before every heading, is
 *    w≈0.018 h≈0.017 in all 13 occurrences. The smallest real sign is h 0.026.
 *  - Caption blocks and heading words are made *of* recognized text, so the text
 *    boxes cover them almost entirely, and they are printed black. The two
 *    measures separate the 97 text crops from the 370 real signs with a wide
 *    margin on both axes: text runs coverage 0.46–1.00 at chroma 36–75, signs
 *    run coverage ≤0.26 at chroma ≥77.
 *
 * Both halves are needed. Chroma alone takes 180 crops, including the grey road
 * markings and the police hand signals. Coverage alone takes the real signs that
 * carry a printed legend across their face.
 */
function isSheetFurniture(r: FigureRegion, lines: OcrLine[]): boolean {
  if (r.h < 0.02 && r.w < 0.025) return true;
  if (r.chroma !== undefined && r.chroma < 90 && textCoverage(r, lines) >= 0.45) return true;
  return false;
}

/**
 * Which section a sign belongs to — the label used to group visually similar
 * signs as each other's distractors, so it has to be right.
 *
 * "The nearest heading above" is not enough: page 9 sets "Police hand signals"
 * and "Provisional signs" side by side on one row, and reading in pure y order
 * puts every sign on the page under whichever of the two sorts last. So headings
 * are grouped into rows, and a row of n headings splits the page into n vertical
 * bands at the midpoints between them. A row of one owns the full width, which
 * is what "Traffic signals" — a narrow heading over a full-width grid — needs.
 *
 * Only plural titles count. Every real section on the sheet heads a group
 * ("Service signs", "Lane markings"); the singular would also admit captions
 * such as "County or municipal boundary sign", which names one sign.
 */
function sectionAssigner(
  heads: { text: string; y: number; x: number; w: number }[],
  medH: number,
): (s: FigureRegion) => string | undefined {
  const sections = heads
    .filter((h) => /\b(signs|signals|markings)$/i.test(h.text))
    .sort((a, b) => a.y - b.y);
  if (!sections.length) return () => undefined;

  type Row = { y: number; bands: { text: string; from: number; to: number }[] };
  const rows: Row[] = [];
  for (const h of sections) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(h.y - last.y) < medH * 1.5) last.bands.push({ text: h.text, from: h.x, to: 1 });
    else rows.push({ y: h.y, bands: [{ text: h.text, from: h.x, to: 1 }] });
  }
  // A heading sits at the left edge of its own panel, so a section's band runs
  // from its heading's left edge to the next heading's. Splitting at the
  // midpoint between headings instead would cut through the wide left panel:
  // on page 9 it puts the second of the two policemen under "Provisional signs".
  const PAD = 0.02;
  for (const row of rows) {
    row.bands.sort((a, b) => a.from - b.from);
    const lefts = row.bands.map((b) => b.from);
    row.bands.forEach((b, i) => {
      b.from = i === 0 ? 0 : lefts[i]! - PAD;
      b.to = i === row.bands.length - 1 ? 1 : lefts[i + 1]! - PAD;
    });
  }

  return (s: FigureRegion) => {
    const cx = s.x + s.w / 2;
    let found: string | undefined;
    for (const row of rows) {
      if (row.y > s.y) break;
      const band = row.bands.find((b) => cx >= b.from && cx < b.to) ?? row.bands[0];
      found = band?.text;
    }
    return found;
  };
}

export function buildSignPage(page: OcrPage, allSigns: FigureRegion[]): PageDoc {
  const allLines = page.lines.filter((l) => !isNoise(l));
  const signs = allSigns.filter((r) => !isSheetFurniture(r, allLines));
  // Text printed on a sign face ("11t", "L19") belongs to the graphic; it must
  // not be picked up as the caption of the sign above it.
  // Judged against the sign's core, not its full box: a crop can overshoot
  // slightly into the caption below, and testing the whole box would make a sign
  // swallow its own label.
  const inAnySign = (l: OcrLine) =>
    signs.some((s) => {
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
      return cx > s.x + s.w * 0.05 && cx < s.x + s.w * 0.95
        && cy > s.y + s.h * 0.15 && cy < s.y + s.h * 0.82;
    });
  const lines = allLines.filter((l) => !inAnySign(l));
  const used = new Set<OcrLine>();

  interface Cell { sign: FigureRegion; caption: string; conf: number; shared?: boolean }
  const cells: Cell[] = [];

  for (const s of signs) {
    const sxc = s.x + s.w / 2;
    const below = lines
      .filter((l) => {
        if (used.has(l)) return false;
        const gap = l.y - (s.y + s.h);
        if (gap < -s.h * 0.25 || gap > 0.05) return false;
        const lxc = l.x + l.w / 2;
        // The label is centred under its sign; allow for wrapped lines running wider.
        return Math.abs(lxc - sxc) < Math.max(s.w * 0.85, 0.035);
      })
      .sort((a, b) => a.y - b.y);

    // Take the contiguous run of label lines, stopping at a large vertical jump.
    const take: OcrLine[] = [];
    for (const l of below) {
      const prev = take[take.length - 1];
      if (prev && l.y - (prev.y + prev.h) > prev.h * 1.2) break;
      take.push(l);
      if (take.length >= 4) break;
    }
    for (const l of take) used.add(l);
    const caption = take.map((l) => cleanText(l.text)).reduce(joinLines, '');
    const conf = take.length ? Math.min(...take.map((l) => l.conf)) : 0;
    cells.push({ sign: s, caption, conf });
  }

  // The sheet prints one caption under a whole group of related signs — eight
  // arrows sharing "Direction of traffic". Only the sign above the caption
  // matched, so let the rest of the row inherit it, flagged as shared.
  const rows: Cell[][] = [];
  for (const c of [...cells].sort((a, b) => a.sign.y - b.sign.y)) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    if (row && ref && Math.abs(c.sign.y - ref.sign.y) < Math.max(ref.sign.h, c.sign.h) * 0.6) row.push(c);
    else rows.push([c]);
  }
  for (const row of rows) {
    const labelled = row.filter((c) => c.caption);
    if (!labelled.length) continue;
    for (const c of row) {
      if (c.caption) continue;
      const cx = c.sign.x + c.sign.w / 2;
      let best: Cell | null = null;
      let bestD = Infinity;
      for (const l of labelled) {
        const d = Math.abs(l.sign.x + l.sign.w / 2 - cx);
        if (d < bestD) { bestD = d; best = l; }
      }
      if (best && bestD < 0.3) {
        c.caption = best.caption;
        c.shared = true;
      }
    }
  }

  // Leftover text is section furniture — "Warning Signs", "Prohibitive signs".
  // Legends printed inside a sign face ("50", "3,5 m", "8t") are part of the
  // graphic, not page text, so they are dropped rather than floated loose.
  const leftover = lines.filter((l) => !used.has(l));
  const heights = lines.map((l) => l.h).filter((h) => h > 0);
  const medH = median(heights);

  const blocks: Block[] = [];
  // Interleave headings and sign cells in page order so sections stay intact.
  type Item = { y: number; block: Block };
  const items: Item[] = [];
  const heads: { text: string; y: number; x: number; w: number }[] = [];
  for (const l of leftover) {
    // The section bullet sits on the heading's own text line, so Vision reports
    // it as a leading glyph — measured as 'U', '™', '"' or '•' across the ten
    // sheets. Stripping it is safe here because no heading on this sheet begins
    // with a standalone letter.
    const t = cleanText(l.text).replace(/^[^\p{L}\p{N}]+/u, '').replace(/^U\s+(?=\p{Lu})/u, '');
    if (t.length < 2) continue;
    const isHead = l.h > medH * 1.25 || /signs?$/i.test(t);
    if (isHead) heads.push({ text: t, y: l.y, x: l.x, w: l.w });
    items.push({
      y: l.y,
      block: isHead
        ? { kind: 'heading', level: 3, text: t, conf: l.conf }
        : { kind: 'caption', text: t, conf: l.conf },
    });
  }
  const groupOf = sectionAssigner(heads, medH);
  for (const c of cells) {
    items.push({
      y: c.sign.y,
      block: {
        kind: 'figure', src: c.sign.file, caption: c.caption, w: c.sign.w,
        shared: c.shared, group: groupOf(c.sign),
      },
    });
  }
  items.sort((a, b) => a.y - b.y);
  blocks.push(...items.map((i) => i.block));

  return {
    seq: page.seq,
    pdfPage: page.pdfPage,
    side: page.side,
    pageLabel: null,
    runningHead: null,
    blocks,
    meanConf: page.meanConf,
    lowConfCount: page.lowConfCount,
    lineCount: lines.length,
    charCount: lines.reduce((n, l) => n + l.text.length, 0),
    imageFile: page.imageFile,
  };
}

/**
 * The lines layout analysis actually runs on, and the furniture pulled out of
 * them: recognition noise and marks inside pictures dropped, folio and running
 * head lifted out.
 */
export function pageBody(
  page: OcrPage,
  figures: FigureRegion[],
): { body: OcrLine[]; pageLabel: string | null; runningHead: string | null } {
  // Marks recognized inside an illustration belong to the illustration, not the
  // prose. Left in, they sort by position into the surrounding column and split a
  // caption apart ("Path for pedestrians and bicycle riders" / "11%" / "only.").
  // Only the region's core counts, so a crop that overshoots slightly cannot
  // swallow neighbouring text.
  const insidePicture = (l: OcrLine) => {
    // Restricted to short or unconfident fragments — the legends and speckle that
    // live inside artwork. A crop that overshoots into a real caption would
    // otherwise cost the picture its label.
    const t = l.text.trim();
    if (t.length > 14 && l.conf >= 0.6) return false;
    return figures.some((f) => {
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
      return cx > f.x + f.w * 0.05 && cx < f.x + f.w * 0.95
        && cy > f.y + f.h * 0.15 && cy < f.y + f.h * 0.82;
    });
  };
  const all = page.lines.filter((l) => !isNoise(l) && !insidePicture(l));

  // Pull page furniture out before layout analysis.
  let pageLabel: string | null = null;
  let runningHead: string | null = null;
  const body: OcrLine[] = [];
  for (const l of all) {
    const t = l.text.trim();
    const nearTop = l.y < 0.075;
    const nearBottom = l.y + l.h > 0.945;
    if ((nearTop || nearBottom) && isPageNumber(t)) {
      if (!pageLabel) pageLabel = t;
      continue;
    }
    if (nearTop && l.w < 0.6) {
      // The folio and the running head sit on one line and Vision usually
      // reports them as a single observation, in either order.
      const m = /^(\d{1,3})\s+(.+)$/.exec(t) ?? /^(.+?)\s+(\d{1,3})$/.exec(t);
      if (m) {
        const [a, b] = [m[1]!.trim(), m[2]!.trim()];
        const [num, head] = isPageNumber(a) ? [a, b] : [b, a];
        if (isRunningHead(head)) {
          if (!pageLabel) pageLabel = num;
          if (!runningHead) runningHead = cleanText(head);
          continue;
        }
      }
      if (isRunningHead(t)) {
        if (!runningHead) runningHead = cleanText(t);
        continue;
      }
    }
    body.push(l);
  }
  return { body, pageLabel, runningHead };
}

export function buildPage(page: OcrPage, figures: FigureRegion[]): PageDoc {
  const { body, pageLabel, runningHead } = pageBody(page, figures);

  const heights = body.map((l) => l.h).filter((h) => h > 0);
  const medH = median(heights);
  // Body text height: the lower-middle of the height distribution, so display
  // type cannot drag the baseline up and hide headings.
  const sorted = [...heights].sort((a, b) => a - b);
  const bodyH = sorted.length
    ? (sorted[Math.floor(sorted.length * 0.45)] ?? medH)
    : medH;
  const ctx: Ctx = { medH, bodyH };

  // A contents page is two columns bound by dot leaders, not prose; reading it in
  // y order both mis-pairs the folios and hides the .toc block entirely.
  const leaders = leaderColumn(body);
  const blocks = leaders
    ? [
        ...tocBlocks(body, leaders, ctx),
        ...figures.map((f): Block => ({ kind: 'figure', src: f.file, caption: '', w: f.w })),
      ]
    : proseBlocks(body, figures, ctx);

  const charCount = body.reduce((n, l) => n + l.text.length, 0);
  return {
    seq: page.seq,
    pdfPage: page.pdfPage,
    side: page.side,
    pageLabel,
    runningHead,
    blocks,
    meanConf: page.meanConf,
    lowConfCount: page.lowConfCount,
    lineCount: body.length,
    charCount,
    imageFile: page.imageFile,
  };
}

function proseBlocks(body: OcrLine[], figures: FigureRegion[], ctx: Ctx): Block[] {
  // frameCut returns no frames at all for an empty page, where the rest of this
  // function still needs one (empty) column to reduce over.
  const frames = frameCut(body);
  const cols = (frames.length ? frames : [body]).map(mkColumn);
  const main = cols.reduce((a, b) => (b.chars > a.chars ? b : a), cols[0]!);

  // Main column flows as the page's prose; the other columns are asides — figure
  // captions and sign labels — reinserted at their own vertical positions.
  const mainPlaced = main.lines.length ? paragraphize(main, ctx) : [];
  const asidePlaced: Placed[] = [];
  for (const c of cols) {
    if (c === main || !c.lines.length) continue;
    asidePlaced.push(...paragraphize(c, ctx));
  }

  // Pair each figure with its caption using both blocks' real geometry. A
  // caption sits just below its figure and shares its horizontal span; captions
  // live in the sidebar on some pages and inline in the text column on others,
  // so both sets are candidates.
  // "Figure n.n …" lines are captions outright. The appendix instead describes
  // each sign in a short narrow paragraph beside it, so those qualify too —
  // bounded by width and length so a full-measure body paragraph can never be
  // absorbed into a figure.
  const captionPool = [...mainPlaced, ...asidePlaced].filter(
    (p) =>
      p.block.kind === 'caption' ||
      (p.block.kind === 'para' && p.w < 0.5 && p.block.text.length <= 240),
  );
  const claimed = new Set<Placed>();
  const figureBlocks: Placed[] = figures.map((f) => {
    let best: Placed | null = null;
    let bestD = Infinity;
    for (const cap of captionPool) {
      if (claimed.has(cap)) continue;
      // Caption underneath, sharing the figure's horizontal span.
      const below = cap.y - (f.y + f.h);
      if (below >= -f.h * 0.35 && below <= 0.09) {
        const overlap = Math.min(f.x + f.w, cap.x + cap.w) - Math.max(f.x, cap.x);
        if (overlap >= Math.min(f.w, cap.w) * 0.35 && Math.abs(below) < bestD) {
          bestD = Math.abs(below);
          best = cap;
          continue;
        }
      }
      // Caption alongside, on the same baseline band — how the appendix sets its
      // sign tables: the graphic on the left, its description to the right.
      const beside = cap.x - (f.x + f.w);
      const sameBand = cap.y < f.y + f.h && cap.y + 0.02 > f.y - f.h * 0.5;
      if (sameBand && beside >= -f.w * 0.2 && beside <= 0.06) {
        // Rank behind a true below-caption at equal distance.
        const d = Math.abs(beside) + 0.005;
        if (d < bestD) { bestD = d; best = cap; }
      }
    }
    let caption = '';
    if (best && (best.block.kind === 'caption' || best.block.kind === 'para')) {
      caption = best.block.text;
      claimed.add(best);
    }
    return { y: f.y, x: f.x, w: f.w, block: { kind: 'figure', src: f.file, caption, w: f.w } };
  });

  const blocks: Block[] = [];
  blocks.push(...mainPlaced.filter((p) => !claimed.has(p)).map((p) => p.block));
  // Figures and remaining asides follow the prose in page order: on a narrow
  // screen the reader gets the page's text first, then its illustrations.
  const extras = [...figureBlocks, ...asidePlaced.filter((p) => !claimed.has(p))]
    .sort((p, q) => p.y - q.y);
  blocks.push(...extras.map((e) => e.block));

  return blocks;
}
