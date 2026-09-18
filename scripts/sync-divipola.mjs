import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const endpoint = 'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000';
const output = resolve('apps/validum/src/data/colombiaTerritories.json');

const response = await fetch(endpoint);
if (!response.ok) throw new Error(`DIVIPOLA respondió ${response.status}`);
const source = await response.json();
const unique = new Map();

for (const row of source) {
  const municipalityCode = String(row.cod_mpio || '').trim();
  const departmentCode = String(row.cod_dpto || '').trim();
  const municipality = String(row.nom_mpio || '').trim().toUpperCase();
  const department = String(row.dpto || '').trim().toUpperCase();
  if (!municipalityCode || !departmentCode || !municipality || !department) continue;
  unique.set(municipalityCode, { departmentCode, department, municipalityCode, municipality });
}

const rows = [...unique.values()].sort((left, right) =>
  left.department.localeCompare(right.department, 'es')
  || left.municipality.localeCompare(right.municipality, 'es'));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`Guardados ${rows.length} municipios DIVIPOLA en ${output}`);
