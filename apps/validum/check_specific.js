import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function check(name, pageNum, minTop, maxTop) {
  const data = new Uint8Array(fs.readFileSync('public/templates/' + name));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const pageHeight = page.view[3];
  console.log(`\n=== ${name} (Page ${pageNum}, H=${pageHeight}) ===`);
  const items = textContent.items
    .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), top: Math.round(pageHeight - it.transform[5]) }))
    .filter(it => it.str.length > 0 && it.top >= minTop && it.top <= maxTop);
  items.sort((a, b) => a.top - b.top);
  for (const it of items) console.log(`  top: ${String(it.top).padStart(4)} | x: ${String(it.x).padStart(3)} | "${it.str}"`);
}

async function run() {
  await check('compensar_afiliacion_2026.pdf', 2, 40, 170);
  await check('famisanar_afiliacion_2026.pdf', 2, 20, 140);
  await check('salud_total_afiliacion_2026.pdf', 1, 660, 750);
}
run().catch(console.error);
