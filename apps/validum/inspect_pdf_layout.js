import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log(`\n=== File: ${path.basename(pdfPath)} (Pages: ${doc.numPages}) ===`);
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    console.log(`--- Page ${i} (viewport: ${page.view[2]}x${page.view[3]}) ---`);
    const items = textContent.items
      .map(item => ({ str: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) }))
      .filter(item => item.str.trim().length > 0);
    
    // Group by Y
    const byY = {};
    for (const item of items) {
      const yKey = Math.round(item.y / 4) * 4;
      if (!byY[yKey]) byY[yKey] = [];
      byY[yKey].push(item);
    }
    const sortedY = Object.keys(byY).map(Number).sort((a, b) => b - a);
    for (const y of sortedY.slice(0, 30)) {
      const line = byY[y].sort((a, b) => a.x - b.x).map(it => `[${it.x}] ${it.str}`).join(' | ');
      console.log(`y=${y}: ${line}`);
    }
  }
}

async function run() {
  const file = process.argv[2] || 'public/templates/nueva_eps_afiliacion_2026.pdf';
  await inspectText(path.resolve(__dirname, file));
}

run().catch(console.error);
