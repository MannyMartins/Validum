import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function checkNueva() {
  const data = new Uint8Array(fs.readFileSync('../../outputs/test_default-nueva-eps-2026_filled.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  const pageHeight = page.view[3];
  console.log(`=== Nueva EPS (Page 1, H=${pageHeight}) ===`);
  const items = textContent.items
    .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), top: Math.round(pageHeight - it.transform[5]) }))
    .filter(it => it.str.length > 0 && (
      it.str.includes('PASTRANA') || it.str.includes('1084924282') || it.str.includes('TECHPLANET') ||
      it.str.includes('CARMEN') || it.str.includes('1.750.905') || it.str === 'X' ||
      it.str.includes('NUEVA') || it.str.includes('COMPENSAR') || it.str.includes('CALLE') ||
      it.str.includes('TRASLADO')
    ));
  items.sort((a, b) => a.top - b.top);
  for (const it of items) console.log(`  top: ${String(it.top).padStart(4)} | x: ${String(it.x).padStart(3)} | "${it.str}"`);
}
checkNueva().catch(console.error);
