import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartOAuthDto {
  @IsOptional()
  @IsEmail({}, { message: 'La sugerencia de cuenta debe ser un correo válido.' })
  @MaxLength(320)
  cuenta?: string;
}

export class UpdateMailboxDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  etiqueta?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  activa?: boolean;
}
