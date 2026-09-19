import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  validateSync,
} from 'class-validator';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export const CATEGORY_LABELS = [
  'Términos jurídicos',
  'Cobros Jurídicos',
  'Consulta General',
  'Soporte Operativo',
] as const;

export const PRIORITY_LABELS = ['Urgente', 'Moderado', 'Respuesta Ligera'] as const;
export const STATUS_LABELS = ['pendiente', 'en_revision', 'respondido', 'archivado'] as const;

export class IngestCorrespondenceDto {
  @IsString() @MaxLength(1000) from!: string;
  @IsString() @MaxLength(1000) to!: string;
  @IsString() @MaxLength(1000) subject!: string;
  @IsString() textPlain!: string;
  @IsString() @MaxLength(1000) messageId!: string;
  @IsString() @MaxLength(1000) threadId!: string;
  @IsDateString() fecha!: string;
  @IsString() @MaxLength(500) remitente_nombre!: string;
  @IsOptional() @IsString() @MaxLength(200) identificacion?: string | null;
  @IsOptional() @IsString() @MaxLength(500) empresa_relacionada?: string | null;
  @IsString() @MaxLength(200) categoria!: string;
  @IsString() @MaxLength(200) prioridad!: string;
  @IsString() resumen!: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(1000, { each: true }) documentos_requeridos!: string[];
  @IsString() propuesta_respuesta!: string;
  @IsBoolean() alerta_inmediata!: boolean;
  @IsOptional() @IsBoolean() error_parseo?: boolean;
  @IsOptional() @IsString() respuesta_cruda?: string;
}

@Injectable()
export class IngestPayloadPipe implements PipeTransform {
  transform(value: unknown): IngestCorrespondenceDto | IngestCorrespondenceDto[] {
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) throw new BadRequestException('El lote de correspondencia está vacío.');
    if (rows.length > 250) throw new BadRequestException('Cada lote admite máximo 250 correos.');

    const parsed = rows.map((row, index) => {
      const dto = plainToInstance(IngestCorrespondenceDto, row);
      const errors = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      });
      if (errors.length) {
        const messages = errors.flatMap(error => Object.values(error.constraints || {}));
        throw new BadRequestException(`Correo ${index + 1}: ${messages.join(' ')}`);
      }
      return dto;
    });

    return Array.isArray(value) ? parsed : parsed[0];
  }
}

export class ListCorrespondenceDto {
  @IsOptional() @IsIn(CATEGORY_LABELS) categoria?: string;
  @IsOptional() @IsIn(PRIORITY_LABELS) prioridad?: string;
  @IsOptional() @IsIn(STATUS_LABELS) estado?: string;
  @IsOptional() @IsString() @MaxLength(1000) cuenta_destino?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() alerta_inmediata?: boolean;
  @IsOptional() @IsDateString() fecha_desde?: string;
  @IsOptional() @IsDateString() fecha_hasta?: string;
  @IsOptional() @IsString() @MaxLength(300) busqueda?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}

export class UpdateCorrespondenceDto {
  @IsOptional() @IsIn(STATUS_LABELS) estado?: string;
  @IsOptional() @IsString() @MaxLength(100) asignado_a?: string | null;
  @IsOptional() @IsString() @MaxLength(20_000) notas_internas?: string | null;
  @IsOptional() @IsString() @MaxLength(100_000) propuesta_respuesta?: string;
}
