/**
 * Work packets: the book split into chunks small enough for one author to hold
 * in their head at once.
 *
 *   npm run packets
 *
 * Splitting is by page run, not by section: section detection on a scanned book
 * is noisy — plenty of "headings" are really mis-measured prose lines — whereas
 * page order is exact. Each packet is a contiguous run of pages from one
 * document, cut at a page boundary near the target size.
 *
 * Emits build/work/packets/<id>.json and a manifest. The authoring contract
 * these feed is described in pipeline/cards/README.md.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Chunk, Dataset } from './dataset.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, 'build/work');
const OUT = path.join(WORK, 'packets');

/** Characters of prose per packet. Big enough to be worth a pass, small enough to read closely. */
const TARGET = 22_000;

export interface PacketPage {
  scan: string;
  pageLabel: string | null;
  href: string;
  chunks: { id: string; kind: Chunk['kind']; text: string; topics: string[] }[];
}

export interface Packet {
  id: string;
  doc: string;
  docTitle: string;
  /** Human range, e.g. "pages 4a–11b". */
  range: string;
  chars: number;
  topics: string[];
  pages: PacketPage[];
}

function main() {
  const ds: Dataset = JSON.parse(readFileSync(path.join(WORK, 'dataset.json'), 'utf8'));
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const packets: Packet[] = [];

  for (const doc of ds.docs) {
    // The sign sheet is a picture grid; its cards come from the sign deck, not prose.
    if (doc.id === 'umferdarmerki-enska') continue;

    // Group this document's usable prose by page, in order.
    const pages = new Map<string, PacketPage>();
    for (const c of ds.chunks) {
      if (c.doc !== doc.id) continue;
      // Tables of contents and one-word fragments carry nothing to test on.
      if (c.kind === 'toc' || c.text.trim().length < 25) continue;
      const p = pages.get(c.src.scan) ?? { scan: c.src.scan, pageLabel: c.src.page, href: c.src.href, chunks: [] };
      p.chunks.push({ id: c.id, kind: c.kind, text: c.text, topics: c.topics });
      pages.set(c.src.scan, p);
    }

    let run: PacketPage[] = [];
    let chars = 0;
    let part = 0;
    const flush = () => {
      if (!run.length) return;
      part++;
      const topics = [...new Set(run.flatMap((p) => p.chunks.flatMap((c) => c.topics)))]
        .filter((t) => t !== 'general')
        .sort();
      packets.push({
        id: `${doc.id}-${String.fromCharCode(96 + part)}`,
        doc: doc.id,
        docTitle: doc.title,
        range: `pages ${run[0]!.scan}–${run[run.length - 1]!.scan}`,
        chars,
        topics,
        pages: run,
      });
      run = [];
      chars = 0;
    };

    for (const p of pages.values()) {
      run.push(p);
      chars += p.chunks.reduce((n, c) => n + c.text.length, 0);
      if (chars >= TARGET) flush();
    }
    // A short tail folds back into the previous packet rather than standing alone.
    if (chars && chars < TARGET * 0.4 && packets.length && packets[packets.length - 1]!.doc === doc.id) {
      const prev = packets[packets.length - 1]!;
      prev.pages.push(...run);
      prev.chars += chars;
      prev.range = `pages ${prev.pages[0]!.scan}–${prev.pages[prev.pages.length - 1]!.scan}`;
      run = [];
      chars = 0;
    }
    flush();
  }

  for (const p of packets) writeFileSync(path.join(OUT, `${p.id}.json`), JSON.stringify(p, null, 1));
  const manifest = packets.map((p) => ({ id: p.id, doc: p.doc, range: p.range, chars: p.chars, pages: p.pages.length, topics: p.topics }));
  writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));

  console.log(`${packets.length} packets → ${OUT}`);
  for (const p of manifest) console.log(`  ${p.id.padEnd(10)} ${p.range.padEnd(20)} ${String(p.chars).padStart(6)} chars  ${p.pages} pages`);
}

main();
