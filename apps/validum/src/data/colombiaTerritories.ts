import territoryRows from './colombiaTerritories.json';

export interface ColombiaTerritory {
  departmentCode: string;
  department: string;
  municipalityCode: string;
  municipality: string;
}

export const COLOMBIA_TERRITORIES = territoryRows as ColombiaTerritory[];

export const COLOMBIA_DEPARTMENTS = [...new Set(
  COLOMBIA_TERRITORIES.map(item => item.department)
)].sort((left, right) => left.localeCompare(right, 'es'));

function normalized(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function municipalitiesForDepartment(department: string): ColombiaTerritory[] {
  const expected = normalized(department);
  if (!expected) return COLOMBIA_TERRITORIES;
  return COLOMBIA_TERRITORIES.filter(item => normalized(item.department) === expected);
}

export function territoryForMunicipality(municipality: string, department = ''): ColombiaTerritory | undefined {
  const expectedMunicipality = normalized(municipality);
  const expectedDepartment = normalized(department);
  return COLOMBIA_TERRITORIES.find(item =>
    normalized(item.municipality) === expectedMunicipality
    && (!expectedDepartment || normalized(item.department) === expectedDepartment));
}
