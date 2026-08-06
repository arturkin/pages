/**
 * Review sheets for human/agent validation of the dataset.
 *
 *   npm run qa:sheets
 *
 * Signs are sheeted by section, so related signs appear together and a wrong
 * label stands out against its neighbours. Every cell carries a short ref;
 * build/qa/sheets/index.json maps each ref back to the sign it came from.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderSheets, type Cell } from './contactsheet.js';
import type { Dataset } from './dataset.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, 'build/work');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'build/qa/sheets');

const shortRef = (id: string) => id.split(':').slice(1).join('-');

async function main() {
  const ds: Dataset = JSON.parse(readFileSync(path.join(WORK, 'dataset.json'), 'utf8'));
  // Wiped, not overwritten. A shrinking category leaves its old sheet 2/2 behind,
  // and a reviewer cannot tell a stale sheet from a live one — which has already
  // cost one validation pass.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const index: Record<string, { id: string; label: string; category: string; img: string }> = {};
  const byCategory = new Map<string, typeof ds.signs>();
  for (const s of ds.signs) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const manifest: { category: string; sheets: string[]; count: number }[] = [];
  for (const [category, list] of byCategory) {
    const cells: Cell[] = list.map((s) => {
      const ref = shortRef(s.id);
      index[ref] = { id: s.id, label: s.label, category: s.category, img: s.img };
      return {
        ref,
        img: 'file://' + path.join(SITE, s.img),
        label: s.label,
        note: [s.shared ? 'inherited label' : '', s.cut ? 'may be clipped' : ''].filter(Boolean).join(' · '),
      };
    });
    const name = 'signs-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const sheets = await renderSheets(cells, {
      outDir: OUT,
      name,
      title: `${category} (${list.length})`,
      perSheet: 24,
      cols: 4,
    });
    manifest.push({ category, sheets: sheets.map((s) => path.basename(s)), count: list.length });
    console.log(`${category}: ${list.length} signs → ${sheets.length} sheet(s)`);
  }

  writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`\n${Object.keys(index).length} signs indexed → ${OUT}`);
}

main();
