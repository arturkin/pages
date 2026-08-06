/**
 * Structured dataset: OCR layout blocks → chapters / sections / chunks + images.
 *
 *   npm run dataset
 *
 * The study app builds on this, never on the HTML. Every chunk carries an id, a
 * topic tag and a source reference back to the page it came from, so any card
 * can be traced to the scan that produced it.
 *
 * Emits build/work/dataset.json.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isRule, type CropGrade } from './build-html.js';
import { buildPage, buildSignPage, type FigureRegion, type OcrPage, type PageDoc } from './layout.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, 'build/work');

// ─────────────────────────────────────────────────────────────────────────────
// Shape

export interface DocMeta {
  id: string;
  base: string;
  title: string;
  subtitle?: string;
  group: 'book' | 'reference';
}

export interface Chunk {
  id: string;
  doc: string;
  /** Section this chunk belongs to, or null before the first heading. */
  section: string | null;
  kind: 'heading' | 'para' | 'list' | 'toc';
  text: string;
  /** List items kept separate so cards can be built per item. */
  items?: string[];
  topics: string[];
  conf: number;
  src: SourceRef;
}

export interface Section {
  id: string;
  doc: string;
  title: string;
  level: number;
  topics: string[];
  chunks: string[];
  src: SourceRef;
}

export interface SourceRef {
  /** Anchor into the HTML edition, e.g. "ch-4.html#p-12a". */
  href: string;
  /** Book folio if the page printed one. */
  page: string | null;
  /** Scan identifier, e.g. "12a". */
  scan: string;
}

export interface SignCard {
  id: string;
  img: string;
  label: string;
  /** Sign-sheet section: "Warning signs", "Prohibitive signs", … */
  category: string;
  doc: string;
  /** Label was printed once for a group and inherited by this member. */
  shared: boolean;
  /** Crop may be clipped at an edge. */
  cut: boolean;
  src: SourceRef;
}

export interface FigureCard {
  id: string;
  img: string;
  caption: string;
  doc: string;
  section: string | null;
  topics: string[];
  cut: boolean;
  src: SourceRef;
}

export interface Dataset {
  meta: Record<string, unknown>;
  docs: DocMeta[];
  sections: Section[];
  chunks: Chunk[];
  signs: SignCard[];
  figures: FigureCard[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents — mirrors build-html's DOCS so ids and hrefs line up.

const DOCS: (DocMeta & { layout?: 'signs'; pictures?: 'signs' })[] = [
  { id: 'ch-1-2', base: 'Ch. 1–2', title: 'Chapters 1–2', group: 'book', subtitle: 'Learning how to drive · The driving test' },
  { id: 'ch-3', base: 'Ch. 3', title: 'Chapter 3', group: 'book' },
  { id: 'ch-4', base: 'Ch. 4', title: 'Chapter 4', group: 'book' },
  { id: 'ch-5', base: 'Ch. 5', title: 'Chapter 5', group: 'book' },
  { id: 'ch-6', base: 'Ch. 6', title: 'Chapter 6', group: 'book' },
  { id: 'ch-7', base: 'Ch. 7', title: 'Chapter 7', group: 'book' },
  { id: 'ch-8', base: 'Ch. 8', title: 'Chapter 8', group: 'book' },
  { id: 'appendix', base: 'Appendix', title: 'Appendix', group: 'book', subtitle: 'Traffic signs, markings and signals', pictures: 'signs' },
  { id: 'umferdarmerki-enska', base: 'umferdarmerki_enska', title: 'Traffic Sign Reference', group: 'reference', subtitle: 'Umferðarmerki — official sign sheet', layout: 'signs' },
];

/**
 * A chunk id must survive the pipeline changing its mind about the page.
 *
 * Numbering blocks positionally looked fine until crop filtering removed 44
 * figures: figures are blocks too, so every chunk after one of them was
 * renumbered and 75 authored citations silently stopped resolving. The id is
 * therefore derived from the content it names — same text on the same page,
 * same id, however the blocks around it change.
 *
 * That guarantee did not reach the sign cards, which are the majority of the
 * deck: a figure block was hashed on `b.src`, and a crop filename ends in its
 * *position on the page* (`…-p001full-s003.png`). One sign more or fewer on a
 * page moved every id after it. Because `sched` and `log` in the app are keyed by
 * card id, that does not merely orphan history, it reattaches it to a different
 * sign — injected orphans showed as `Seen 900 / Total 745`. A sign on the sheet
 * is therefore hashed on its printed caption plus its section, which is what a
 * reader would call its identity, and `checkSignIds` below asserts that a rebuild
 * over unchanged sources reproduces every id byte for byte.
 */
function contentId(doc: string, scan: string, text: string, taken: Set<string>): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  const base = `${doc}:${scan}:${(h >>> 0).toString(36)}`;
  let id = base;
  // Two identical lines on one page would otherwise collide.
  for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
  taken.add(id);
  return id;
}

/** Same slug rule build-html uses to name the staged JPEGs. */
const slug = (s: string) =>
  s.toLowerCase().replace(/[–—]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** figures/Ch. 4-p012a-f03.png → figures/ch-4-p012a-f03.jpg, as staged in site/. */
const imgUrl = (src: string) => `figures/${slug(path.basename(src, '.png'))}.jpg`;

// ─────────────────────────────────────────────────────────────────────────────
// Topic tagging
//
// A coarse subject index over the book, used to weight question selection and
// to drive the per-topic dashboard. Patterns are matched against the chunk text
// together with its section title, so a paragraph inside "Roundabouts" is tagged
// even when it never repeats the word.

export const TOPICS: { id: string; label: string; re: RegExp }[] = [
  { id: 'speed', label: 'Speed limits', re: /\b(speed|km\/?h|kilometres per hour|too fast|slow down|speeding)\b/i },
  { id: 'right-of-way', label: 'Right of way', re: /\b(right of way|give way|yield|priority|stop sign|crossroads?|intersections?|junctions?)\b/i },
  { id: 'signs', label: 'Signs & markings', re: /\b(sign|signs|road marking|markings|traffic light|signals?|kerb|lane line)\b/i },
  { id: 'alcohol', label: 'Alcohol, drugs & fitness', re: /\b(alcohol|drunk|drink|blood alcohol|per mille|‰|drugs?|medicin|fatigue|tired|sleep)\b/i },
  { id: 'overtaking', label: 'Overtaking', re: /\b(overtak|passing (?:a|another) vehicle|pull out|oncoming)\b/i },
  { id: 'parking', label: 'Stopping & parking', re: /\b(park(?:ing|ed)?|stopping|stand(?:ing)? still|no waiting)\b/i },
  { id: 'roundabout', label: 'Roundabouts', re: /\b(roundabout|circle)\b/i },
  { id: 'weather', label: 'Weather & winter driving', re: /\b(winter|snow|ice|icy|slippery|fog|wind|storm|rain|black ice|studded|frost)\b/i },
  { id: 'gravel', label: 'Gravel & rural roads', re: /\b(gravel|unpaved|dirt road|blind (?:hill|rise|curve)|single[- ]lane bridge|highland|f-road|ford|river crossing|off[- ]road)\b/i },
  { id: 'animals', label: 'Animals & hazards', re: /\b(sheep|animal|horse|reindeer|livestock|bird)\b/i },
  { id: 'lights', label: 'Lights & visibility', re: /\b(headlight|dipped|full beam|high beam|low beam|hazard light|indicator|turn signal|daytime running|visibilit)\b/i },
  { id: 'occupants', label: 'Seat belts, children & load', re: /\b(seat ?belt|child seat|restraint|airbag|passenger|load|cargo|trailer|towing|roof rack|weight)\b/i },
  { id: 'documents', label: 'Licences, documents & insurance', re: /\b(licen[cs]e|registration|insurance|inspection|documents?|permit|probation)\b/i },
  { id: 'accidents', label: 'Accidents & emergencies', re: /\b(accident|collision|crash|emergency|first aid|112|breakdown|warning triangle|injur)\b/i },
  { id: 'vulnerable', label: 'Pedestrians & cyclists', re: /\b(pedestrian|crossing|zebra|cyclist|bicycle|bike|child(?:ren)? (?:on|near)|school)\b/i },
  { id: 'motorway', label: 'Motorways & tunnels', re: /\b(motorway|dual carriageway|tunnel|slip road|merge|merging|main road)\b/i },
  { id: 'vehicle', label: 'Vehicle & maintenance', re: /\b(tyres?|tires?|brakes?|engine|steering|clutch|gear|fuel|battery|maintenance|technical|windscreen|wiper|abs)\b/i },
  { id: 'rules', label: 'Rules, offences & penalties', re: /\b(prohibit|forbidden|fine|penalt|point|offence|illegal|must not|obliged|police|regulations?|law)\b/i },
  { id: 'test', label: 'Learning & the driving test', re: /\b(driving test|instructor|lesson|learner|examin|theory test|ökunámsbók|practice driving|driving school)\b/i },
  { id: 'behaviour', label: 'Attitude & road behaviour', re: /\b(attitude|behaviour|courtes|aggressi|distract|mobile phone|consideration|anticipat|risk)\b/i },
];

function tagTopics(text: string, context: string): string[] {
  const hay = `${context}\n${text}`;
  const hits = TOPICS.filter((t) => t.re.test(hay)).map((t) => t.id);
  return hits.length ? hits : ['general'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Build

function loadDocPages(): Map<string, PageDoc[]> {
  const ocrDir = path.join(WORK, 'ocr');
  if (!existsSync(ocrDir)) throw new Error(`missing ${ocrDir} — run npm run ocr first`);

  const figManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'figures.json'), 'utf8'));
  const signManifest: Record<string, FigureRegion[]> = JSON.parse(readFileSync(path.join(WORK, 'signs.json'), 'utf8'));
  const cropQa: CropGrade[] = JSON.parse(readFileSync(path.join(WORK, 'crop-qa.json'), 'utf8'));
  const rejected = new Set(
    cropQa.filter((c) => c.verdict === 'text-only' || c.verdict === 'blank' || isRule(c)).map((c) => c.file),
  );
  const chroma = new Map(cropQa.map((c) => [c.file, c.meanChroma]));

  const signDocs = new Set(DOCS.filter((d) => d.layout === 'signs').map((d) => d.base));
  const signPictureDocs = new Set(DOCS.filter((d) => d.layout === 'signs' || d.pictures === 'signs').map((d) => d.base));

  const byDoc = new Map<string, PageDoc[]>();
  for (const f of readdirSync(ocrDir).filter((n) => n.endsWith('.json'))) {
    const page: OcrPage = JSON.parse(readFileSync(path.join(ocrDir, f), 'utf8'));
    const key = f.replace(/\.json$/, '');
    const source = signPictureDocs.has(page.doc) ? signManifest : figManifest;
    const regions = (source[key] ?? [])
      .filter((r) => !rejected.has(r.file))
      .map((r) => ({ ...r, chroma: chroma.get(r.file) }));
    const built = signDocs.has(page.doc) ? buildSignPage(page, regions) : buildPage(page, regions);
    const list = byDoc.get(page.doc) ?? [];
    list.push(built);
    byDoc.set(page.doc, list);
  }
  for (const list of byDoc.values()) list.sort((a, b) => a.pdfPage - b.pdfPage || a.side.localeCompare(b.side));
  return byDoc;
}

export function buildDataset(): Dataset {
  const byDoc = loadDocPages();
  const cropQa: { file: string; verdict: string }[] = JSON.parse(readFileSync(path.join(WORK, 'crop-qa.json'), 'utf8'));
  const cutSet = new Set(cropQa.filter((c) => c.verdict === 'cut').map((c) => c.file));

  const docs: DocMeta[] = [];
  const sections: Section[] = [];
  const chunks: Chunk[] = [];
  const signs: SignCard[] = [];
  const figures: FigureCard[] = [];

  for (const spec of DOCS) {
    const pages = byDoc.get(spec.base);
    if (!pages) continue;
    const { layout, pictures, ...meta } = spec;
    void pictures;
    docs.push(meta);

    let section: Section | null = null;
    // The sign sheet groups signs under headings; the current one classifies
    // every sign below it, which is what makes visually-similar distractors
    // possible.
    let category = 'Other signs';
    const taken = new Set<string>();

    for (const p of pages) {
      const scan = `${p.pdfPage}${p.side}`;
      const src: SourceRef = { href: `${spec.id}.html#p-${scan}`, page: p.pageLabel, scan };
      const context = [spec.title, p.runningHead, section?.title].filter(Boolean).join(' ');

      for (const b of p.blocks) {
        // The sheet groups signs under headings and buildSignPage resolves the
        // group from page geometry, so this has to be read before the id is made:
        // a sign's identity is its printed caption within its section.
        if (layout === 'signs' && b.kind === 'figure') category = b.group ?? category;
        const label =
          b.kind === 'list' ? b.items.join(' · ')
          : b.kind === 'toc' ? b.entries.map((e) => e.text).join(' · ')
          : b.kind === 'figure' ? (layout === 'signs' ? `${b.caption ?? ''}|${category}` : b.src)
          : b.kind === 'question' ? b.prompt
          : b.text;
        const id = contentId(spec.id, scan, label, taken);
        switch (b.kind) {
          case 'heading': {
            const sec: Section = {
              id: `s:${id}`,
              doc: spec.id,
              title: b.text,
              level: b.level,
              topics: tagTopics(b.text, context),
              chunks: [],
              src,
            };
            sections.push(sec);
            section = sec;
            chunks.push({ id, doc: spec.id, section: sec.id, kind: 'heading', text: b.text, topics: sec.topics, conf: b.conf, src });
            sec.chunks.push(id);
            break;
          }
          case 'para':
          case 'caption': {
            const c: Chunk = {
              id, doc: spec.id, section: section?.id ?? null, kind: 'para',
              text: b.text, topics: tagTopics(b.text, context), conf: b.conf, src,
            };
            chunks.push(c);
            section?.chunks.push(id);
            break;
          }
          case 'list': {
            const text = b.items.join(' · ');
            const c: Chunk = {
              id, doc: spec.id, section: section?.id ?? null, kind: 'list',
              text, items: b.items, topics: tagTopics(text, context), conf: b.conf, src,
            };
            chunks.push(c);
            section?.chunks.push(id);
            break;
          }
          case 'toc': {
            chunks.push({
              id, doc: spec.id, section: section?.id ?? null, kind: 'toc',
              text: b.entries.map((e) => e.text).join(' · '), topics: ['general'], conf: b.conf, src,
            });
            break;
          }
          case 'figure': {
            const cut = cutSet.has(b.src);
            if (layout === 'signs') {
              signs.push({
                id, img: imgUrl(b.src), label: b.caption, category,
                doc: spec.id, shared: !!b.shared, cut, src,
              });
            } else {
              figures.push({
                id, img: imgUrl(b.src), caption: b.caption, doc: spec.id,
                section: section?.id ?? null, topics: tagTopics(b.caption, context), cut, src,
              });
            }
            break;
          }
          case 'question':
            break;
        }
      }
    }
  }

  return {
    meta: {
      docs: docs.length,
      sections: sections.length,
      chunks: chunks.length,
      signs: signs.length,
      labelledSigns: signs.filter((s) => s.label).length,
      figures: figures.length,
      captionedFigures: figures.filter((f) => f.caption).length,
    },
    docs, sections, chunks, signs, figures,
  };
}

/**
 * Sign ids are study history, so churn in them has to be a decision rather than
 * a side effect.
 *
 * The baseline is hand-made data, not derived: it lives beside the authored cards
 * and records `id → label` for every sign the sheet produced. A rebuild over
 * unchanged sources must reproduce it exactly. When a change is meant to move ids
 * — a new section, a re-cut sheet, anything that changes a printed caption as
 * captured — refresh it deliberately with `npm run dataset -- --update-ids` and say
 * so in the commit, because every refreshed id costs the student that card's
 * schedule and history.
 *
 * **A label correction is not such a change, and never was.** The `label` fed to
 * `contentId` above is the caption as OCR captured it, straight off the block;
 * `pipeline/cards/sign-label-corrections.json` is loaded by
 * `loadLabelCorrections` in `cards.ts` and applied in `usableSigns`, strictly
 * downstream of this file. (Named, not line-numbered: four line citations in these
 * comments went stale within the hour this session, this one among them.) So
 * correcting a label cannot move an id, and
 * `--update-ids` is the wrong tool for one — measured over B12's 27 corrections,
 * which moved 0 of 357 ids and orphaned nothing.
 *
 * The consequence to know before reading the baseline: it records **OCR strings,
 * not what the deck teaches**. `umferdarmerki-enska:6full:1u74i2b → "FO CE"` is the
 * card that ships as `Police`, and the same holds for all 27 corrections. That is
 * correct for its job — proving ids are stable — and wrong to read as a label
 * inventory; `app/data/cards.json` is the record of what the student sees.
 */
const ID_BASELINE = path.join(ROOT, 'pipeline/cards/sign-id-baseline.json');

function checkSignIds(signs: SignCard[], update: boolean): boolean {
  const current: Record<string, string> = {};
  for (const s of signs) current[s.id] = s.label;
  if (update || !existsSync(ID_BASELINE)) {
    writeFileSync(ID_BASELINE, `${JSON.stringify(current, null, 1)}\n`);
    console.log(`sign-id-baseline.json ${update ? 'refreshed' : 'created'}: ${signs.length} ids`);
    return true;
  }
  const base: Record<string, string> = JSON.parse(readFileSync(ID_BASELINE, 'utf8'));
  const gone = Object.keys(base).filter((id) => !(id in current));
  const added = Object.keys(current).filter((id) => !(id in base));
  const moved = Object.keys(current).filter((id) => id in base && base[id] !== current[id]);
  if (!gone.length && !added.length && !moved.length) {
    console.log(`sign ids stable: ${signs.length} ids match sign-id-baseline.json`);
    return true;
  }
  console.error(
    `\nsign card ids moved — ${gone.length} gone, ${added.length} new, ${moved.length} re-pointed.` +
      ` Every one of these loses or misattributes a card's study history.`,
  );
  for (const id of gone.slice(0, 12)) console.error(`  gone     ${id}  ${JSON.stringify(base[id])}`);
  for (const id of added.slice(0, 12)) console.error(`  new      ${id}  ${JSON.stringify(current[id])}`);
  for (const id of moved.slice(0, 12)) console.error(`  repoint  ${id}  ${JSON.stringify(base[id])} → ${JSON.stringify(current[id])}`);
  console.error('\nIf this is intended, re-run with: npm run dataset -- --update-ids\n');
  return false;
}

function main() {
  const ds = buildDataset();
  mkdirSync(WORK, { recursive: true });
  writeFileSync(path.join(WORK, 'dataset.json'), JSON.stringify(ds, null, 1));
  console.log('dataset.json written:', JSON.stringify(ds.meta));
  if (!checkSignIds(ds.signs, process.argv.includes('--update-ids'))) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
