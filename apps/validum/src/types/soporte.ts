export type CategoriaSoporte =
  | 'Identificación'
  | 'Certificado Bancario'
  | 'RUT'
  | 'Contrato'
  | 'Seguridad Social'
  | 'Formulario Firmado'
  | 'Afiliación EPS'
  | 'Certificado Laboral'
  | 'Otro';

export interface MetadataSoporte {
  paginas?: number;
  efecto_escaner_aplicado?: boolean;
  cotizante_id?: string | null;
  cotizante_nombre?: string | null;
  empresa_id?: string | null;
  dpi?: 72 | 150 | 300;
  tags?: string[];
  notas?: string;
  originalFileName?: string;
  processedAt?: string;
}

export interface SoporteDocumento {
  id: string;
  nombre: string;
  categoria: CategoriaSoporte;
  tipo_archivo: 'pdf' | 'png' | 'jpg' | 'jpeg';
  tamano_bytes: number;
  storage_path: string;
  metadata: MetadataSoporte;
  created_at: string;
  updated_at: string;
  // URL local temporal o firmada de Supabase
  publicUrl?: string;
  blobData?: Blob;
}

export type ScanColorMode = 'color' | 'grayscale' | 'bw';

export interface ScanFilterOptions {
  colorMode: ScanColorMode;
  borderShadow: boolean;
  rotation: number; // -5 a 5 grados
  rotationVariance: number; // 0 a 5 grados varianza aleatoria
  brightness: number; // -100 a 100
  contrast: number; // -100 a 100
  blur: number; // 0 a 3 px
  noise: number; // 0 a 100%
  yellowing: number; // 0 a 100%
  dpi: 72 | 150 | 300;
  compressionQuality: number; // 0.60 a 0.95
}

export const DEFAULT_SCAN_OPTIONS: ScanFilterOptions = {
  colorMode: 'bw',
  borderShadow: true,
  rotation: -0.75,
  rotationVariance: 1.2,
  brightness: 12,
  contrast: 24,
  blur: 0.6,
  noise: 28,
  yellowing: 15,
  dpi: 150,
  compressionQuality: 0.82
};

export interface PageScanProgress {
  currentPage: number;
  totalPages: number;
  phase: 'idle' | 'rendering' | 'filtering' | 'compressing' | 'assembling' | 'done';
  statusText: string;
}
