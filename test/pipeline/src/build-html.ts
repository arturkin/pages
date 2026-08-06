/**
 * Builds the readable HTML edition from the OCR output in build/work.
 *
 *   npm run build:html
 *
 * Emits site/ : one page per source document, an index, a QA report, plus
 * downscaled page scans so every transcription can be checked against the
 * original image.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPage, buildSignPage, type Block, type FigureRegion, type OcrPage, type PageDoc } from './layout.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, 'build/work');
const SITE = path.join(ROOT, 'site');
/** Self-hosted webfonts, checked in here (not under site/, which is wiped every build). */
const FONTS_SRC = path.join(ROOT, 'pipeline/assets/fonts');

interface DocSpec {
  base: string;
  title: string;
  group: 'book' | 'reference';
  subtitle?: string;
  /** 'signs' renders a labelled grid instead of prose columns. */
  layout?: 'prose' | 'signs';
  /**
   * Where this document's pictures come from. The appendix sets its signs in
   * tight tables, where the generic finder merges neighbours into one sliced
   * strip, so it uses per-sign detection while keeping the prose layout.
   */
  pictures?: 'figures' | 'signs';
}

/** Reading order of the source material. */
const DOCS: DocSpec[] = [
  { base: 'Ch. 1–2', title: 'Chapters 1–2', group: 'book', subtitle: 'Learning how to drive · The driving test' },
  { base: 'Ch. 3', title: 'Chapter 3', group: 'book' },
  { base: 'Ch. 4', title: 'Chapter 4', group: 'book' },
  { base: 'Ch. 5', title: 'Chapter 5', group: 'book' },
  { base: 'Ch. 6', title: 'Chapter 6', group: 'book' },
  { base: 'Ch. 7', title: 'Chapter 7', group: 'book' },
  { base: 'Ch. 8', title: 'Chapter 8', group: 'book' },
  { base: 'Appendix', title: 'Appendix', group: 'book', subtitle: 'Traffic signs, markings and signals', pictures: 'signs' },
  { base: 'umferdarmerki_enska', title: 'Traffic Sign Reference', group: 'reference', subtitle: 'Umferðarmerki — official sign sheet', layout: 'signs' },
];

export interface CropGrade {
  file: string;
  verdict: string;
  meanChroma: number;
  contentFrac: number;
  w: number;
  h: number;
}

/**
 * The decorative rule printed under every running head, and the slivers of page
 * gutter beside a column, both survive crop grading as "ok" — they are ink, and
 * they are one connected component. They are not illustrations: on screen a
 * 900px-tall gutter sliver fills a whole phone viewport with a near-blank strip.
 *
 * They are the only crops that are both extremely elongated and almost empty.
 * Measured over the 1,209 published crops, all 56 matching ratio ≥ 6 with under
 * 12% ink are page furniture, and no real illustration comes close — the long
 * thin signs that do exist carry 18–39% ink.
 */
export function isRule(c: CropGrade): boolean {
  const ratio = Math.max(c.w / c.h, c.h / c.w);
  return ratio >= 6 && c.contentFrac < 0.12;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─────────────────────────────────────────────────────────────────────────────
// Load OCR output

function loadPages(): { byDoc: Map<string, PageDoc[]>; cutCrops: Set<string> } {
  const ocrDir = path.join(WORK, 'ocr');
  if (!existsSync(ocrDir)) throw new Error(`missing ${ocrDir} — run npm run ocr first`);

  const figManifest: Record<string, FigureRegion[]> = existsSync(path.join(WORK, 'figures.json'))
    ? JSON.parse(readFileSync(path.join(WORK, 'figures.json'), 'utf8'))
    : {};
  const signManifest: Record<string, FigureRegion[]> = existsSync(path.join(WORK, 'signs.json'))
    ? JSON.parse(readFileSync(path.join(WORK, 'signs.json'), 'utf8'))
    : {};
  const signDocs = new Set(DOCS.filter((d) => d.layout === 'signs').map((d) => d.base));
  const signPictureDocs = new Set(
    DOCS.filter((d) => d.layout === 'signs' || d.pictures === 'signs').map((d) => d.base),
  );

  // Crops graded as non-pictures are dropped rather than published: a caption
  // fragment or a blank patch is not an illustration.
  const cropQa: CropGrade[] = existsSync(path.join(WORK, 'crop-qa.json'))
    ? JSON.parse(readFileSync(path.join(WORK, 'crop-qa.json'), 'utf8'))
    : [];
  // checkcrops' text-only rule ("many small blobs, no dominant shape, no colour")
  // was measured against signs, where it holds — a correctly framed sign is one
  // dominant shape. It misfires on this book's line-art figures: a diagram made
  // of thin disconnected strokes (tire tread, cable diagrams, sign chevrons,
  // outline cartoons) trips the same signature as scattered caption text, because
  // neither has one big filled blob. A width/aspect/footprint split was tried
  // against a sample of confirmed real diagrams vs. confirmed genuine caption
  // fragments and none separated them — the false-positive rate on figure crops
  // is high enough (most of a 20-crop visual sample) that a corpus-wide numeric
  // retuning risks trading known-good caption drops for unreviewed figure
  // regressions. Each entry below was instead opened and confirmed by eye against
  // its source scan; see pipeline/figure-grade-overrides.json for the reasons.
  // Not exhaustive — more misgraded figures likely remain unreviewed corpus-wide.
  const gradeOverrides = new Set<string>(
    existsSync(path.join(ROOT, 'pipeline/figure-grade-overrides.json'))
      ? (JSON.parse(readFileSync(path.join(ROOT, 'pipeline/figure-grade-overrides.json'), 'utf8')) as {
          file: string;
        }[]).map((o) => o.file)
      : [],
  );
  const rejected = new Set(
    cropQa
      .filter((c) => (c.verdict === 'text-only' || c.verdict === 'blank' || isRule(c)) && !gradeOverrides.has(c.file))
      .map((c) => c.file),
  );
  const cutCrops = new Set(cropQa.filter((c) => c.verdict === 'cut').map((c) => c.file));
  const chroma = new Map(cropQa.map((c) => [c.file, c.meanChroma]));

  const byDoc = new Map<string, PageDoc[]>();
  for (const f of readdirSync(ocrDir).filter((n) => n.endsWith('.json'))) {
    const page: OcrPage = JSON.parse(readFileSync(path.join(ocrDir, f), 'utf8'));
    const key = f.replace(/\.json$/, '');
    const source = signPictureDocs.has(page.doc) ? signManifest : figManifest;
    const regions = (source[key] ?? [])
      .filter((r) => !rejected.has(r.file))
      .map((r) => ({ ...r, chroma: chroma.get(r.file) }));
    const doc = signDocs.has(page.doc)
      ? buildSignPage(page, regions)
      : buildPage(page, regions);
    const list = byDoc.get(page.doc) ?? [];
    list.push(doc);
    byDoc.set(page.doc, list);
  }
  for (const list of byDoc.values()) {
    list.sort((a, b) => a.pdfPage - b.pdfPage || a.side.localeCompare(b.side));
  }
  return { byDoc, cutCrops };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image preparation

/** Downscale with sips (native, no dependencies) and keep the site self-contained. */
function prepareImage(srcAbs: string, destAbs: string, maxDim: number): boolean {
  if (!existsSync(srcAbs)) return false;
  mkdirSync(path.dirname(destAbs), { recursive: true });
  try {
    execFileSync('/usr/bin/sips', ['-Z', String(maxDim), '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', srcAbs, '--out', destAbs], {
      stdio: 'ignore',
    });
    return existsSync(destAbs);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering

function renderBlock(b: Block, figMap: Map<string, string>, cut?: Set<string>): string {
  const lowConf = (c: number) => (c < 0.6 ? ' class="uncertain"' : '');
  switch (b.kind) {
    case 'heading':
      return `<h${b.level}${lowConf(b.conf)}>${esc(b.text)}</h${b.level}>`;
    case 'para':
      return `<p${lowConf(b.conf)}>${esc(b.text)}</p>`;
    case 'caption':
      return `<p class="caption${b.conf < 0.6 ? ' uncertain' : ''}">${esc(b.text)}</p>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      const items = b.items.map((i) => `<li>${esc(i)}</li>`).join('');
      // A numbered list split across blocks by an interleaved column resumes at
      // the enumerator the book printed, rather than restarting at 1.
      const start = b.ordered && b.start && b.start > 1 ? ` start="${b.start}"` : '';
      return `<${tag}${start}${lowConf(b.conf)}>${items}</${tag}>`;
    }
    case 'toc': {
      const rows = b.entries
        .map((e) => `<li><span class="toc-t">${esc(e.text)}</span><span class="toc-p">${esc(e.page)}</span></li>`)
        .join('');
      return `<ul class="toc">${rows}</ul>`;
    }
    case 'question': {
      const opts = b.options.map((o) => `<li>${esc(o)}</li>`).join('');
      return `<div class="q"><p class="q-prompt"><b>${esc(b.n)}.</b> ${esc(b.prompt)}</p><ul class="q-opts">${opts}</ul></div>`;
    }
    case 'figure': {
      const src = figMap.get(b.src);
      if (!src) return '';
      const cap = b.caption
        ? `<figcaption${b.shared ? ' class="shared"' : ''}>${esc(b.caption)}</figcaption>`
        : '';
      const marks = [b.caption ? '' : 'nolabel', cut?.has(b.src) ? 'cropwarn' : ''].filter(Boolean);
      const cls = marks.length ? ` class="${marks.join(' ')}"` : '';
      return `<figure${cls}><img src="${esc(src)}" alt="${esc(b.caption || 'Illustration from the page scan')}" loading="lazy">${cap}</figure>`;
    }
  }
}

/** Consecutive figure blocks become one responsive grid. */
function renderBlocks(blocks: Block[], figMap: Map<string, string>, grid: boolean, cut: Set<string>): string {
  if (!grid) return blocks.map((b) => renderBlock(b, figMap, cut)).join('\n  ');
  const out: string[] = [];
  let run: Block[] = [];
  const flush = () => {
    if (!run.length) return;
    const cards = run
      .map((b) => renderBlock(b, figMap, cut))
      .filter(Boolean)
      .join('');
    if (cards) out.push(`<div class="siggrid">${cards}</div>`);
    run = [];
  };
  for (const b of blocks) {
    if (b.kind === 'figure') run.push(b);
    else {
      flush();
      out.push(renderBlock(b, figMap, cut));
    }
  }
  flush();
  return out.join('\n  ');
}

function renderDoc(spec: DocSpec, pages: PageDoc[], figMap: Map<string, string>, scanMap: Map<string, string>, nav: string, cut: Set<string>): string {
  const parts: string[] = [];
  for (const p of pages) {
    const hasContent = p.blocks.length > 0;
    if (!hasContent) continue;
    const label = p.pageLabel ? `p. ${esc(p.pageLabel)}` : `scan ${p.pdfPage}${p.side}`;
    const scan = scanMap.get(p.imageFile);
    parts.push(`<section class="page" id="p-${p.pdfPage}${p.side}" data-seq="${p.seq}" data-conf="${p.meanConf.toFixed(3)}">
  <div class="page-meta"><span class="pnum">${label}</span>${
      p.runningHead ? `<span class="rhead">${esc(p.runningHead)}</span>` : ''
    }<span class="conf" title="mean OCR confidence">${(p.meanConf * 100).toFixed(0)}%</span></div>
  ${renderBlocks(p.blocks, figMap, spec.layout === 'signs' || spec.pictures === 'signs', cut)}
  ${scan ? `<details class="scan"><summary>View original scan</summary><img src="${esc(scan)}" alt="Original scanned page ${p.pdfPage}${p.side}" loading="lazy"></details>` : ''}
</section>`);
  }

  const stats = {
    pages: pages.filter((p) => p.blocks.length).length,
    chars: pages.reduce((n, p) => n + p.charCount, 0),
    conf: pages.length ? pages.reduce((n, p) => n + p.meanConf, 0) / pages.length : 0,
  };

  return page(
    `${spec.title} — Driving in Iceland`,
    `<header class="doc-head">
  <a class="back" href="index.html">&larr; Contents</a>
  <h1>${esc(spec.title)}</h1>
  ${spec.subtitle ? `<p class="sub">${esc(spec.subtitle)}</p>` : ''}
  <p class="stats">${stats.pages} pages · ${stats.chars.toLocaleString('en-US')} characters · OCR confidence ${(stats.conf * 100).toFixed(1)}%</p>
</header>
<main>
${parts.join('\n')}
</main>
${nav}`,
  );
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
${body}
<script src="assets/app.js" defer></script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main

function main() {
  const { byDoc, cutCrops: cutSet } = loadPages();
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(path.join(SITE, 'assets/fonts'), { recursive: true });
  for (const f of readdirSync(FONTS_SRC)) {
    copyFileSync(path.join(FONTS_SRC, f), path.join(SITE, 'assets/fonts', f));
  }

  // Stage images once, shared across documents.
  const figMap = new Map<string, string>();
  const scanMap = new Map<string, string>();
  let figCount = 0;
  let scanCount = 0;

  for (const list of byDoc.values()) {
    for (const p of list) {
      const rel = p.imageFile; // e.g. pages/Ch. 3-p004a.png
      const out = `scans/${slug(path.basename(rel, '.png'))}.jpg`;
      if (prepareImage(path.join(WORK, rel), path.join(SITE, out), 1400)) {
        scanMap.set(rel, out);
        scanCount++;
      }
      for (const b of p.blocks) {
        if (b.kind !== 'figure') continue;
        const fout = `figures/${slug(path.basename(b.src, '.png'))}.jpg`;
        if (prepareImage(path.join(WORK, b.src), path.join(SITE, fout), 900)) {
          figMap.set(b.src, fout);
          figCount++;
        }
      }
    }
  }

  const present = DOCS.filter((d) => byDoc.has(d.base));
  const qa: Record<string, unknown>[] = [];

  present.forEach((spec, i) => {
    const pages = byDoc.get(spec.base)!;
    const prev = present[i - 1];
    const next = present[i + 1];
    const nav = `<nav class="pager">${
      prev ? `<a href="${slug(prev.base)}.html">&larr; ${esc(prev.title)}</a>` : '<span></span>'
    }${next ? `<a href="${slug(next.base)}.html">${esc(next.title)} &rarr;</a>` : '<span></span>'}</nav>`;
    writeFileSync(path.join(SITE, `${slug(spec.base)}.html`), renderDoc(spec, pages, figMap, scanMap, nav, cutSet));

    for (const p of pages) {
      qa.push({
        doc: spec.base,
        page: `${p.pdfPage}${p.side}`,
        pageLabel: p.pageLabel,
        conf: +p.meanConf.toFixed(3),
        lines: p.lineCount,
        chars: p.charCount,
        lowConf: p.lowConfCount,
        blocks: p.blocks.length,
        empty: p.blocks.length === 0,
      });
    }
  });

  // Index
  const groups: { key: DocSpec['group']; label: string }[] = [
    { key: 'book', label: 'Driving in Iceland — the textbook' },
    { key: 'reference', label: 'Reference' },
  ];
  const totalChars = qa.reduce((n, r) => n + (r.chars as number), 0);
  const totalPages = qa.filter((r) => !r.empty).length;
  const meanConf = qa.length ? qa.reduce((n, r) => n + (r.conf as number), 0) / qa.length : 0;

  const indexBody = `<header class="site-head">
  <h1>Driving in Iceland</h1>
  <p class="sub">Searchable text edition, generated from the scanned PDFs by on-device OCR.</p>
  <p class="stats">${present.length} documents · ${totalPages} pages · ${totalChars.toLocaleString('en-US')} characters · ${figCount} figures · mean OCR confidence ${(meanConf * 100).toFixed(1)}%</p>
</header>
<main>
${groups
  .map((g) => {
    const items = present.filter((d) => d.group === g.key);
    if (!items.length) return '';
    return `<section class="group">
  <h2>${esc(g.label)}</h2>
  <ul class="doclist">
${items
  .map((d) => {
    const pages = byDoc.get(d.base)!;
    const chars = pages.reduce((n, p) => n + p.charCount, 0);
    return `    <li><a href="${slug(d.base)}.html"><span class="dt">${esc(d.title)}</span>${
      d.subtitle ? `<span class="ds">${esc(d.subtitle)}</span>` : ''
    }<span class="dm">${pages.filter((p) => p.blocks.length).length} pages · ${chars.toLocaleString('en-US')} chars</span></a></li>`;
  })
  .join('\n')}
  </ul>
</section>`;
  })
  .join('\n')}
<section class="group">
  <h2>Quality</h2>
  <p><a href="qa.html">OCR quality report</a> — per-page confidence, so any weak transcription can be spotted and checked against the scan.</p>
</section>
</main>`;
  writeFileSync(path.join(SITE, 'index.html'), page('Driving in Iceland — text edition', indexBody));

  // QA report
  const rows = qa
    .map(
      (r) =>
        `<tr class="${(r.conf as number) < 0.75 ? 'warn' : ''}"><td>${esc(String(r.doc))}</td><td>${esc(String(r.page))}</td><td>${
          r.pageLabel ?? '—'
        }</td><td>${((r.conf as number) * 100).toFixed(0)}%</td><td>${r.lines}</td><td>${r.chars}</td><td>${r.lowConf}</td><td>${r.blocks}</td></tr>`,
    )
    .join('\n');
  writeFileSync(
    path.join(SITE, 'qa.html'),
    page(
      'OCR quality report',
      `<header class="doc-head"><a class="back" href="index.html">&larr; Contents</a><h1>OCR quality report</h1>
<p class="sub">Rows below 75% mean confidence are highlighted. Blank page-sides are expected: book spreads include blank inner covers.</p></header>
<main><div class="tablewrap"><table class="qa">
<thead><tr><th>Document</th><th>Scan</th><th>Book&nbsp;p.</th><th>Conf</th><th>Lines</th><th>Chars</th><th>Low</th><th>Blocks</th></tr></thead>
<tbody>${rows}</tbody></table></div></main>`,
    ),
  );

  writeFileSync(path.join(SITE, 'assets/style.css'), CSS);
  writeFileSync(path.join(SITE, 'assets/app.js'), APPJS);
  writeFileSync(path.join(ROOT, 'build/qa-report.json'), JSON.stringify(qa, null, 2));

  console.log(`site/ written: ${present.length} documents, ${totalPages} pages, ${figCount} figures, ${scanCount} scans`);
  console.log(`mean OCR confidence ${(meanConf * 100).toFixed(1)}%`);
}

const CSS = `/* Driving in Iceland — text edition. Mobile-first, readable, theme-aware. */
/* Merriweather, self-hosted (regular/bold/italic only — the reading face this
   edition is set in). font-display: swap so a cold cache never blocks paint. */
@font-face {
  font-family: "Merriweather";
  font-style: normal; font-weight: 400;
  src: url("fonts/merriweather-regular.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Merriweather";
  font-style: normal; font-weight: 700;
  src: url("fonts/merriweather-bold.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Merriweather";
  font-style: italic; font-weight: 400;
  src: url("fonts/merriweather-italic.woff2") format("woff2");
  font-display: swap;
}
:root {
  --bg: #fbfaf7;
  --fg: #1c1b19;
  --muted: #6b675f;
  --rule: #e2ded4;
  --accent: #0a5c8a;
  --card: #ffffff;
  --warn-bg: #fff6e5;
  --measure: 34rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17181a;
    --fg: #e8e6e1;
    --muted: #9d9891;
    --rule: #2e3033;
    --accent: #6fb8e0;
    --card: #1e2023;
    --warn-bg: #33291a;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 400 1.0625rem/1.62 "Merriweather", ui-serif, Georgia, "Times New Roman", serif;
  padding: 0 1.15rem env(safe-area-inset-bottom) 1.15rem;
  overflow-wrap: break-word;
}
main, header, nav { max-width: var(--measure); margin: 0 auto; }
h1, h2, h3, h4 { font-family: ui-sans-serif, -apple-system, "Helvetica Neue", sans-serif; line-height: 1.25; }
h1 { font-size: 1.65rem; margin: 1.2rem 0 .4rem; letter-spacing: -.01em; }
h2 { font-size: 1.3rem; margin: 2rem 0 .5rem; }
h3 { font-size: 1.12rem; margin: 1.6rem 0 .4rem; }
h4 { font-size: 1rem; margin: 1.3rem 0 .35rem; color: var(--muted); }
p { margin: 0 0 .85rem; }
a { color: var(--accent); }
.site-head, .doc-head { padding-top: 1.4rem; border-bottom: 1px solid var(--rule); padding-bottom: .9rem; }
.sub { color: var(--muted); font-size: .95rem; margin-bottom: .3rem; }
.stats { color: var(--muted); font-size: .82rem; font-family: ui-sans-serif, sans-serif; margin: 0; }
.back { font-family: ui-sans-serif, sans-serif; font-size: .85rem; text-decoration: none; }

/* Index */
.group { margin-top: 2rem; }
.doclist { list-style: none; padding: 0; margin: 0; }
.doclist li { margin-bottom: .6rem; }
.doclist a {
  display: block; background: var(--card); border: 1px solid var(--rule);
  border-radius: .7rem; padding: .8rem .95rem; text-decoration: none; color: var(--fg);
}
.doclist a:hover { border-color: var(--accent); }
.dt { display: block; font-family: ui-sans-serif, sans-serif; font-weight: 600; }
.ds { display: block; color: var(--muted); font-size: .88rem; margin-top: .1rem; }
.dm { display: block; color: var(--muted); font-size: .76rem; font-family: ui-sans-serif, sans-serif; margin-top: .35rem; }

/* Pages */
.page { padding: 1.4rem 0; border-bottom: 1px dashed var(--rule); }
.page-meta {
  display: flex; gap: .6rem; align-items: baseline; flex-wrap: wrap;
  font-family: ui-sans-serif, sans-serif; font-size: .72rem; color: var(--muted);
  text-transform: uppercase; letter-spacing: .06em; margin-bottom: .7rem;
}
.pnum { font-weight: 600; }
.rhead { opacity: .75; }
.conf { margin-left: auto; }
.uncertain { background: var(--warn-bg); border-radius: .2rem; }
.caption { font-size: .86rem; color: var(--muted); font-style: italic; }
ul, ol { padding-left: 1.35rem; margin: 0 0 .9rem; }
li { margin-bottom: .3rem; }

/* Table of contents blocks inside the scans */
.toc { list-style: none; padding: 0; }
.toc li { display: flex; gap: .5rem; align-items: baseline; font-size: .95rem; }
.toc-t { flex: 1; }
.toc-t::after {
  content: ""; display: inline-block; width: 100%; margin-left: .3rem;
  border-bottom: 1px dotted var(--rule); transform: translateY(-.25em);
}
.toc-p { color: var(--muted); font-variant-numeric: tabular-nums; }

/* Figures */
figure { margin: 1.2rem 0; text-align: center; }
figure img { max-width: 100%; max-height: 60vh; height: auto; border-radius: .4rem; background: #fff; }
figcaption { font-size: .82rem; color: var(--muted); margin-top: .4rem; font-style: italic; }

/* Sign reference grid: every sign as its own card with its label */
.siggrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: .55rem;
  margin: .9rem 0 1.4rem;
}
.siggrid figure {
  margin: 0; padding: .5rem .35rem .45rem;
  background: var(--card); border: 1px solid var(--rule); border-radius: .5rem;
  display: flex; flex-direction: column; align-items: center; gap: .35rem;
}
.siggrid figure img { max-height: 4.2rem; width: auto; max-width: 100%; }
.siggrid figcaption {
  font-style: normal; font-family: ui-sans-serif, sans-serif; font-size: .7rem;
  line-height: 1.3; color: var(--fg); margin: 0; text-align: center;
}
.siggrid figure.nolabel { outline: 1px dashed var(--muted); }
/* Label printed once for a group of related signs in the source */
.siggrid figcaption.shared { color: var(--muted); }
.siggrid figcaption.shared::before { content: "↳ "; }
/* Crop whose content runs to the edge — may be clipped; check the page scan */
figure.cropwarn img { outline: 2px solid #d98324; outline-offset: 2px; }

/* Practice-test questions */
.q { margin: 1rem 0; padding: .85rem .95rem; background: var(--card); border: 1px solid var(--rule); border-radius: .6rem; }
.q-prompt { margin-bottom: .5rem; }
.q-opts { list-style: none; padding-left: 0; margin: 0; }
.q-opts li { padding-left: 1.5rem; position: relative; }
.q-opts li::before {
  content: ""; position: absolute; left: 0; top: .42em;
  width: .8em; height: .8em; border: 1px solid var(--muted); border-radius: .15em;
}

/* Original scan */
.scan { margin-top: 1.1rem; }
.scan summary {
  cursor: pointer; font-family: ui-sans-serif, sans-serif; font-size: .8rem;
  color: var(--accent); list-style: none;
}
.scan summary::-webkit-details-marker { display: none; }
.scan summary::before { content: "⌗ "; }
.scan img { width: 100%; height: auto; margin-top: .7rem; border: 1px solid var(--rule); border-radius: .4rem; }

/* Pager */
.pager { display: flex; justify-content: space-between; gap: 1rem; padding: 1.6rem 0 2.5rem; font-family: ui-sans-serif, sans-serif; font-size: .9rem; }
.pager a { text-decoration: none; }

/* QA table */
.tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table.qa { border-collapse: collapse; font-family: ui-sans-serif, sans-serif; font-size: .8rem; min-width: 34rem; }
table.qa th, table.qa td { text-align: left; padding: .35rem .55rem; border-bottom: 1px solid var(--rule); white-space: nowrap; }
table.qa tr.warn { background: var(--warn-bg); }

@media (min-width: 46rem) {
  :root { --measure: 40rem; }
  body { font-size: 1.09375rem; padding: 0 2rem 2rem; }
  h1 { font-size: 2rem; }
}
`;

const APPJS = `// Remember which scans the reader opened, so a reload keeps their place.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('scan')) return;
  const id = d.closest('.page')?.id;
  if (!id) return;
  const key = 'scan:' + location.pathname + '#' + id;
  try { d.open ? localStorage.setItem(key, '1') : localStorage.removeItem(key); } catch {}
}, true);

for (const d of document.querySelectorAll('details.scan')) {
  const id = d.closest('.page')?.id;
  if (!id) continue;
  try { if (localStorage.getItem('scan:' + location.pathname + '#' + id)) d.open = true; } catch {}
}
`;

main();
