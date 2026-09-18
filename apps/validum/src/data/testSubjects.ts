import type { Beneficiario, Empleado, Empresa } from '../types/validum';

export const TEST_SUBJECT_PREFIX = 'validum-test-2026-';

const TEST_EPS = [
  'Capital Salud',
  'Compensar',
  'Famisanar',
  'Nueva EPS',
  'Proteger EPS',
  'Salud Mía',
  'Salud Total',
  'Sanitas',
  'SOS',
  'Sura',
] as const;

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function testSignature(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 150;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#111827';
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(30, 105);
  context.bezierCurveTo(95, 25, 145, 145, 220, 72);
  context.bezierCurveTo(275, 20, 315, 135, 395, 65);
  context.bezierCurveTo(430, 38, 465, 78, 510, 54);
  context.stroke();
  context.fillStyle = '#111827';
  context.font = '18px sans-serif';
  context.fillText(label, 160, 132);
  return canvas.toDataURL('image/png');
}

function familyFor(subjectId: string, familyNumber: number, principalSex: 'F' | 'M'): Beneficiario[] {
  const spouseSex = principalSex === 'F' ? 'M' : 'F';
  const familySurname = principalSex === 'F' ? 'PRUEBA' : 'CONTROL';
  return [
    {
      id: `${subjectId}-conyuge`,
      parentesco: 'CONYUGE',
      tipoDocumento: 'CC',
      numeroDocumento: String(880000000 + familyNumber * 10 + 1),
      primerNombre: spouseSex === 'F' ? 'MARIA' : 'CARLOS',
      segundoNombre: 'PRUEBA',
      primerApellido: familySurname,
      segundoApellido: 'VALIDUM',
      fechaNacimiento: spouseSex === 'F' ? '1991-04-12' : '1989-08-23',
      sexo: spouseSex,
      identidadGenero: spouseSex === 'F' ? 'FEMENINO' : 'MASCULINO',
      nacionalidad: 'COLOMBIANA',
      paisNacimiento: 'COLOMBIA',
      departamentoNacimiento: 'SANTANDER',
      municipioNacimiento: 'BUCARAMANGA',
      discapacidad: 'NINGUNA',
      condicion: '',
      municipio: 'BUCARAMANGA',
      departamento: 'SANTANDER',
      zona: 'U',
      telefono: '3000000000',
      ipsSeleccionada: 'IPS PRUEBA VALIDUM',
      codigoIps: 'TEST-IPS-01',
    },
    {
      id: `${subjectId}-hijo`,
      parentesco: 'HIJO(A)',
      tipoDocumento: 'TI',
      numeroDocumento: String(770000000 + familyNumber * 10 + 2),
      primerNombre: 'MATEO',
      primerApellido: familySurname,
      segundoApellido: 'VALIDUM',
      fechaNacimiento: '2013-03-15',
      sexo: 'M',
      identidadGenero: 'MASCULINO',
      nacionalidad: 'COLOMBIANA',
      paisNacimiento: 'COLOMBIA',
      departamentoNacimiento: 'SANTANDER',
      municipioNacimiento: 'BUCARAMANGA',
      discapacidad: 'NINGUNA',
      municipio: 'BUCARAMANGA',
      departamento: 'SANTANDER',
      zona: 'U',
      telefono: '3000000000',
      ipsSeleccionada: 'IPS PRUEBA VALIDUM',
      codigoIps: 'TEST-IPS-01',
    },
    {
      id: `${subjectId}-hija`,
      parentesco: 'HIJO(A)',
      tipoDocumento: 'TI',
      numeroDocumento: String(770000000 + familyNumber * 10 + 3),
      primerNombre: 'SOFIA',
      primerApellido: familySurname,
      segundoApellido: 'VALIDUM',
      fechaNacimiento: '2016-09-08',
      sexo: 'F',
      identidadGenero: 'FEMENINO',
      nacionalidad: 'COLOMBIANA',
      paisNacimiento: 'COLOMBIA',
      departamentoNacimiento: 'SANTANDER',
      municipioNacimiento: 'BUCARAMANGA',
      discapacidad: 'NINGUNA',
      municipio: 'BUCARAMANGA',
      departamento: 'SANTANDER',
      zona: 'U',
      telefono: '3000000000',
      ipsSeleccionada: 'IPS PRUEBA VALIDUM',
      codigoIps: 'TEST-IPS-01',
    },
  ];
}

export function buildTestSubjects(company: Empresa): Empleado[] {
  const companyId = company.id;
  return TEST_EPS.flatMap((eps, epsIndex) => (['F', 'M'] as const).map((sex, sexIndex) => {
    const number = epsIndex * 2 + sexIndex + 1;
    const epsSlug = slug(eps);
    const subjectId = `${TEST_SUBJECT_PREFIX}${epsSlug}-${sex.toLowerCase()}`;
    const female = sex === 'F';
    const firstName = female ? 'LAURA' : 'DANIEL';
    const secondName = female ? 'SOFIA' : 'ANDRES';
    const firstSurname = 'PRUEBA';
    const secondSurname = eps.replace(/\bEPS\b/gi, '').trim().toUpperCase();
    return {
      id: subjectId,
      cedula: String(990000000 + number),
      tipoDocumento: 'CC',
      numeroDocumento: String(990000000 + number),
      nombres: `${firstName} ${secondName}`,
      apellidos: `${firstSurname} ${secondSurname}`,
      primerNombre: firstName,
      segundoNombre: secondName,
      primerApellido: firstSurname,
      segundoApellido: secondSurname,
      sexo: sex,
      identidadGenero: female ? 'FEMENINO' : 'MASCULINO',
      nacionalidad: 'COLOMBIANA',
      fechaNacimiento: female ? '1990-06-18' : '1988-02-24',
      paisNacimiento: 'COLOMBIA',
      departamentoNacimiento: 'SANTANDER',
      ciudadNacimiento: 'BUCARAMANGA',
      paisExpedicion: 'COLOMBIA',
      departamentoExpedicion: 'SANTANDER',
      ciudadExpedicion: 'BUCARAMANGA',
      fechaExpedicion: '2008-05-20',
      departamentoResidencia: 'SANTANDER',
      ciudadResidencia: 'BUCARAMANGA',
      localidadComuna: 'COMUNA 12',
      direccion: 'CALLE 45 20 30 APTO 202',
      barrio: 'CABECERA DEL LLANO',
      zona: 'U',
      telefonoCotizante: `300100${String(number).padStart(4, '0')}`,
      telefonoFijo: '6076000000',
      emailCotizante: `prueba.${epsSlug}.${sex.toLowerCase()}@validum.test`,
      eps,
      codigoEps: `TEST-${String(epsIndex + 1).padStart(2, '0')}`,
      ipsSeleccionada: 'IPS PRUEBA VALIDUM',
      codigoIps: 'TEST-IPS-01',
      tipoAfiliacion: 'NOVEDAD',
      modalidadAfiliacion: 'INDIVIDUAL',
      regimen: 'CONTRIBUTIVO',
      tipoAfiliado: 'COTIZANTE',
      tipoCotizante: 'DEPENDIENTE',
      tipoCotizanteCodigo: '01',
      tipoNovedad: 'INICIO_RELACION',
      fechaNovedad: '2026-09-18',
      solicitudSat: 'NO',
      cargo: female ? 'ANALISTA DE PRUEBAS' : 'OPERADOR DE PRUEBAS',
      departamento: company.departamento || 'SANTANDER',
      fechaIngreso: '2026-09-18',
      salarioBase: 1750905,
      ibc: 1750905,
      afp: 'Porvenir',
      ccf: 'Comfenalco Santander',
      arl: company.arl || 'Positiva',
      riesgoArl: 1,
      estado: 'PRUEBA',
      empresaId: companyId,
      beneficiarios: familyFor(subjectId, number, sex),
      documentos: [],
      firmaDigitalCotizante: testSignature(`FIRMA PRUEBA ${firstName}`),
      firmaDigitalEmpresa: testSignature('FIRMA EMPRESA PRUEBA'),
    } satisfies Empleado;
  }));
}
