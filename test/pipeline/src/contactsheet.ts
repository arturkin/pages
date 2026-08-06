/**
 * Contact sheets for visual review.
 *
 * There is no ImageMagick on this machine, so sheets are laid out as HTML and
 * screenshotted with the Playwright Chromium that the e2e suite already pulls
 * in. Each cell shows the crop, the index used to report a problem, and the
 * label the pipeline paired with it — everything a reviewer needs to say
 * "cell 14 is wrong" without opening the dataset.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export interface Cell {
  /** Stable identifier a reviewer quotes when reporting a mismatch. */
  ref: string;
  /** Absolute path or file:// URL of the image. */
  img: string;
  label: string;
  note?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sheetHtml(cells: Cell[], title: string, cols: number): string {
  return `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; background:#fff; font:13px/1.35 -apple-system,Helvetica,sans-serif; color:#111; }
  h1 { font-size:15px; margin:10px 12px; }
  .grid { display:grid; grid-template-columns:repeat(${cols},1fr); gap:6px; padding:0 12px 12px; }
  .cell { border:1px solid #ccc; border-radius:5px; padding:6px 4px; text-align:center;
          display:flex; flex-direction:column; align-items:center; gap:5px; background:#fff; }
  .ref { font:700 12px ui-monospace,monospace; color:#b3261e; }
  .imgbox { height:96px; display:flex; align-items:center; justify-content:center; width:100%; }
  img { max-height:96px; max-width:100%; object-fit:contain; }
  .lab { font-size:12px; line-height:1.25; word-break:break-word; }
  .none { color:#999; font-style:italic; }
  .note { font-size:10px; color:#666; font-family:ui-monospace,monospace; }
  </style><h1>${esc(title)}</h1><div class="grid">${cells
    .map(
      (c) => `<div class="cell"><div class="ref">${esc(c.ref)}</div>
    <div class="imgbox"><img src="${esc(c.img)}"></div>
    <div class="lab${c.label ? '' : ' none'}">${esc(c.label || '(no label)')}</div>
    ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</div>`,
    )
    .join('')}</div>`;
}

/**
 * Render `cells` into paginated PNG sheets.
 * Returns the paths written.
 */
export async function renderSheets(
  cells: Cell[],
  opts: { outDir: string; name: string; title: string; perSheet?: number; cols?: number },
): Promise<string[]> {
  const perSheet = opts.perSheet ?? 40;
  const cols = opts.cols ?? 5;
  mkdirSync(opts.outDir, { recursive: true });

  const browser = await chromium.launch();
  const pageCtx = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  const written: string[] = [];

  const total = Math.ceil(cells.length / perSheet) || 1;
  for (let i = 0; i < total; i++) {
    const slice = cells.slice(i * perSheet, (i + 1) * perSheet);
    if (!slice.length) break;
    const num = String(i + 1).padStart(2, '0');
    const html = sheetHtml(slice, `${opts.title} — sheet ${i + 1}/${total}`, cols);
    const htmlPath = path.join(opts.outDir, `.${opts.name}-${num}.html`);
    writeFileSync(htmlPath, html);
    await pageCtx.goto(`file://${htmlPath}`);
    await pageCtx.waitForLoadState('networkidle');
    const out = path.join(opts.outDir, `${opts.name}-${num}.png`);
    await pageCtx.screenshot({ path: out, fullPage: true });
    written.push(out);
  }

  await browser.close();
  return written;
}
