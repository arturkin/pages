import { readFileSync } from 'node:fs';
import { buildSignPage } from './layout.js';
const signs = JSON.parse(readFileSync('build/work/signs.json', 'utf8'));
for (const k of Object.keys(signs).sort()) {
  const page = JSON.parse(readFileSync(`build/work/ocr/${k}.json`, 'utf8'));
  const d = buildSignPage(page, signs[k]);
  const figs = d.blocks.filter((b: any) => b.kind === 'figure') as any[];
  const lab = figs.filter((f) => f.caption).length;
  const ws = signs[k].map((s: any) => s.w as number);
  console.log(
    k.replace('umferdarmerki_enska-', '').padEnd(10),
    `signs=${String(figs.length).padStart(3)}`,
    `labelled=${String(lab).padStart(3)}`,
    `ocrLines=${String(page.lines.length).padStart(3)}`,
    ws.length ? `w=${Math.min(...ws).toFixed(3)}..${Math.max(...ws).toFixed(3)}` : '',
  );
}
