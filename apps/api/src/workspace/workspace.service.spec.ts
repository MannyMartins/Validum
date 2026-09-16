import { BadRequestException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService affiliation validation', () => {
  const service = new WorkspaceService({} as never, {} as never);

  it('does not allow filing without an explicit affiliation type', async () => {
    await expect(service.saveAffiliationFolio('org-1', { id: 'company-1' }, { id: 'employee-1' }))
      .rejects.toThrow(new BadRequestException('Debes definir claramente el tipo de afiliación antes de radicar.'));
  });

  it('does not allow a novelty filing without its specific novelty type', async () => {
    await expect(service.saveAffiliationFolio('org-1', { id: 'company-1' }, {
      id: 'employee-1', tipoAfiliacion: 'NOVEDAD', tipoNovedad: '',
    })).rejects.toThrow(new BadRequestException('Debes definir el tipo específico de novedad antes de radicar.'));
  });
});
