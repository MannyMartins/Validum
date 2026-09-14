import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function checkSura() {
  const data = new Uint8Array(fs.readFileSync('public/templates/sura_afiliacion_2026.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  const pageHeight = page.view[3];
  console.log(`\n=== Sura Page 1 (H=${pageHeight}) ===`);
  const items = textContent.items
    .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), top: Math.round(pageHeight - it.transform[5]) }))
    .filter(it => it.str.length > 0 && it.top >= 250 && it.top <= 400);
  items.sort((a, b) => a.top - b.top);
  for (const it of items) console.log(`  top: ${String(it.top).padStart(4)} | x: ${String(it.x).padStart(3)} | "${it.str}"`);
}
checkSura().catch(console.error);
