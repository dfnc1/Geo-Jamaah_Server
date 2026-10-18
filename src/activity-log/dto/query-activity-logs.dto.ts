import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '@generated/prisma/client';

/** Batas halaman (kolom `limit`): default 20, maksimum 100. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Query parameter GET /v1/admin/activity-logs. Semua field opsional.
 * `page`/`limit` menerima string query dan diubah ke integer (global
 * ValidationPipe memakai `transform: true` + `enableImplicitConversion`).
 */
export class QueryActivityLogsDto {
  @ApiPropertyOptional({ enum: Role, description: 'Filter tepat role pelaku' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: 'musyrif1', description: 'Filter tepat username' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ example: 'Izin', description: 'Filter tepat modul' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modul?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description:
      'Tanggal WIB awal (inklusif), format YYYY-MM-DD. Diukur dari awal hari WIB (UTC+7).',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-18',
    description:
      'Tanggal WIB akhir (inklusif), format YYYY-MM-DD. Diukur sampai akhir hari WIB (UTC+7).',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1, description: 'Nomor halaman (mulai 1)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? DEFAULT_PAGE : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
    description: 'Jumlah log per halaman (maksimum 100)',
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? DEFAULT_LIMIT : Number(value)))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;
}
