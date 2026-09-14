import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import { useValidum } from '../../context/ValidumContext';
import type { Empleado } from '../../types/validum';

interface BulkImportModalProps { isOpen: boolean; onClose: () => void }

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ''; continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose }) => {
  const { addEmpleados, empleados } = useValidum();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsProcessing(true); setError(''); setImportedCount(null);
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Selecciona un archivo CSV. Excel puede guardar cualquier hoja como CSV UTF-8.');
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (rows.length < 2) throw new Error('El archivo no contiene filas para importar.');
      const headers = rows[0].map(normalizeHeader);
      const at = (row: string[], ...names: string[]) => {
        const index = headers.findIndex(header => names.includes(header));
        return index >= 0 ? (row[index] || '').trim() : '';
      };
      const parsed: Empleado[] = rows.slice(1).map((row, index) => {
        const document = at(row, 'cedula', 'numerodocumento', 'documento');
        const names = at(row, 'nombres', 'nombre');
        const surnames = at(row, 'apellidos', 'apellido');
        if (!document || !names || !surnames) throw new Error(`Fila ${index + 2}: faltan Documento, Nombres o Apellidos.`);
        const salary = Number(at(row, 'salario', 'salariobase', 'ibc').replace(/[^0-9.-]/g, '')) || 0;
        const risk = Math.min(5, Math.max(1, Number(at(row, 'riesgoarl')) || 1)) as 1 | 2 | 3 | 4 | 5;
        return {
          id: `afi-${crypto.randomUUID()}`, cedula: document, numeroDocumento: document,
          tipoDocumento: at(row, 'tipodocumento') || 'CC', nombres: names, apellidos: surnames,
          primerNombre: names.split(/\s+/)[0] || '', segundoNombre: names.split(/\s+/).slice(1).join(' '),
          primerApellido: surnames.split(/\s+/)[0] || '', segundoApellido: surnames.split(/\s+/).slice(1).join(' '),
          eps: at(row, 'eps'), afp: at(row, 'afp'), arl: at(row, 'arl'), ccf: at(row, 'ccf', 'cajacompensacion'),
          tipoCotizante: at(row, 'tipocotizante') || 'DEPENDIENTE', cargo: at(row, 'cargo'), departamento: at(row, 'area', 'departamento'),
          fechaIngreso: at(row, 'fechaingreso'), salarioBase: salary, ibc: salary, riesgoArl: risk, nivelRiesgoArl: risk,
          estado: 'Activo', estadoEps: 'Activo', emailCotizante: at(row, 'email', 'correo'), telefonoCotizante: at(row, 'telefono', 'celular'),
          documentos: [], beneficiarios: [],
        };
      });
      const unique = new Set<string>();
      for (const employee of parsed) {
        if (unique.has(employee.cedula)) throw new Error(`Documento repetido dentro del archivo: ${employee.cedula}.`);
        if (empleados.some(item => item.cedula === employee.cedula || item.numeroDocumento === employee.cedula)) throw new Error(`El afiliado ${employee.cedula} ya existe.`);
        unique.add(employee.cedula);
      }
      await addEmpleados(parsed);
      setImportedCount(parsed.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo importar el archivo.');
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = 'Tipo Documento,Documento,Nombres,Apellidos,EPS,AFP,ARL,CCF,Tipo Cotizante,Salario,Cargo,Área,Fecha Ingreso,Email,Teléfono,Riesgo ARL\r\nCC,123456789,NOMBRE,APELLIDOS,EPS,AFP,ARL,CCF,DEPENDIENTE,1300000,CARGO,ÁREA,2026-01-15,correo@empresa.com,3000000000,1\r\n';
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'plantilla_afiliados_validum.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
    <div className="w-full max-w-lg rounded-3xl border-2 border-[#c4d600] bg-[#0f2537] p-6 shadow-2xl sm:p-8">
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4"><div className="flex items-center gap-3"><FileSpreadsheet className="w-7 text-[#c4d600]" /><div><h3 className="font-serif text-xl font-bold text-slate-100">Importar cotizantes</h3><p className="text-xs text-slate-400">CSV UTF-8 exportado desde Excel</p></div></div><button onClick={onClose}><X className="w-5 text-slate-400" /></button></div>
      {importedCount !== null ? <div className="space-y-3 py-6 text-center"><CheckCircle2 className="mx-auto w-12 text-[#c4d600]" /><h4 className="text-xl font-bold text-white">Importación completada</h4><p className="text-sm text-slate-300">Se guardaron {importedCount} afiliados.</p><button onClick={onClose} className="rounded-xl bg-[#c4d600] px-6 py-2.5 text-xs font-bold text-[#0f2537]">Cerrar</button></div> : <div className="space-y-5">
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => void handleFile(event.target.files?.[0])} />
        <button type="button" disabled={isProcessing} onClick={() => inputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-[#c4d600]/50 bg-[#0a1824] p-8 text-center hover:border-[#c4d600] disabled:opacity-50"><Upload className="mx-auto mb-3 w-10 text-[#c4d600]" /><span className="block text-xs font-bold text-slate-200">{isProcessing ? 'Validando y guardando…' : 'Seleccionar archivo CSV'}</span><span className="mt-2 block text-[10px] text-slate-400">Documento, Nombres y Apellidos son obligatorios.</span></button>
        {error && <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle className="w-4 shrink-0" />{error}</div>}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs"><button onClick={downloadTemplate} className="flex items-center gap-1.5 font-bold text-[#c4d600]"><Download className="w-4" />Descargar plantilla CSV</button><button onClick={onClose} className="rounded-xl border border-slate-800 px-4 py-2 text-slate-400">Cancelar</button></div>
      </div>}
    </div>
  </div>;
};
