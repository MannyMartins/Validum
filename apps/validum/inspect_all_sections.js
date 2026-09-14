import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SGSSS_2026_TEMPLATES } from './src/data/sgsssTemplateMappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectSections(template) {
  const pdfPath = path.join(__dirname, 'public', template.pdfAssetPath);
  if (!fs.existsSync(pdfPath)) return;
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  console.log(`\n======================================================`);
  console.log(`TEMPLATE: ${template.name} (${template.id}) - Pages: ${doc.numPages}`);
  console.log(`======================================================`);

  for (let pageNum = 1; pageNum <= Math.min(doc.numPages, 2); pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;

    console.log(`\n--- Page ${pageNum} (${pageWidth.toFixed(1)} x ${pageHeight.toFixed(1)}) ---`);

    // Find key section markers and their Y coordinates
    const markers = [
      'DATOS DEL TRÁMITE',
      'DATOS BÁSICOS DE IDENTIFICACIÓN',
      'DATOS COMPLEMENTARIOS',
      'MIEMBROS DEL NÚCLEO FAMILIAR',
      'CÓNYUGE',
      'BENEFICIARIOS',
      'INSTITUCIÓN PRESTADORA DE SERVICIOS',
      'PRESTADORA DE SERVICIOS DE SALUD',
      'IPS',
      'DATOS DE IDENTIFICACIÓN DEL EMPLEADOR',
      'DATOS DEL APORTANTE',
      'REPORTE DE NOVEDADES',
      'DATOS ACTUALIZADOS',
      'DECLARACIONES Y AUTORIZACIONES',
      'CONTRIBUCIÓN SOLIDARIA',
      'FIRMAS',
      'ANEXOS',
      'ENTIDAD TERRITORIAL',
      'FUNCIONARIO',
      'OBSERVACIONES',
    ];

    const found = [];
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      const strNorm = item.str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      for (const m of markers) {
        if (strNorm.includes(m)) {
          const yFromBottom = item.transform[5];
          const topFromTop = pageHeight - yFromBottom;
          found.push({
            marker: m,
            text: item.str.trim(),
            x: Math.round(item.transform[4]),
            yFromBottom: Math.round(yFromBottom),
            topFromTop: Math.round(topFromTop),
          });
        }
      }
    }

    // Sort by topFromTop
    found.sort((a, b) => a.topFromTop - b.topFromTop);
    // Deduplicate markers that appear multiple times closely
    const unique = [];
    for (const f of found) {
      if (!unique.some(u => u.marker === f.marker && Math.abs(u.topFromTop - f.topFromTop) < 15)) {
        unique.push(f);
      }
    }

    for (const u of unique) {
      console.log(`  top: ${String(u.topFromTop).padStart(4)} | y: ${String(u.yFromBottom).padStart(4)} | x: ${String(u.x).padStart(3)} | [${u.marker}] -> "${u.text}"`);
    }
  }
}

async function run() {
  for (const t of SGSSS_2026_TEMPLATES) {
    await inspectSections(t);
  }
}

run().catch(console.error);
