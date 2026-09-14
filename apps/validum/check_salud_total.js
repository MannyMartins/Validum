import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function checkSaludTotal() {
  const data = new Uint8Array(fs.readFileSync('public/templates/salud_total_afiliacion_2026.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const pageHeight = page.view[3];
    console.log(`\n=== Salud Total Page ${p} (H=${pageHeight}) ===`);
    const items = textContent.items
      .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), top: Math.round(pageHeight - it.transform[5]) }))
      .filter(it => it.str.length > 0);
    console.log(`Found ${items.length} text items`);
    for (const it of items.filter(it => it.str.includes('IPS') || it.str.includes('53') || it.str.includes('Prestadora') || it.str.includes('APORTANTE') || it.str.includes('EMPLEADOR') || it.str.includes('TRÁMITE') || it.str.includes('NOVEDADES'))) {
      console.log(`  top: ${String(it.top).padStart(4)} | x: ${String(it.x).padStart(3)} | "${it.str}"`);
    }
  }
}
checkSaludTotal().catch(console.error);
