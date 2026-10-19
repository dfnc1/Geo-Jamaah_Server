import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
import { Roles } from '@src/auth/decorators/roles.decorator';
import { ActivityLogService } from './activity-log.service';
import {
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

// ---------------------------------------------------------------------------
// DTO query (filter + pagination) — menetap di file ini (maksimal 4 file).
// ---------------------------------------------------------------------------

/** Batas halaman (kolom `limit`): default 20, maksimum 100. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Query parameter GET /v1/admin/activity-logs. Semua field opsional.
 * `page`/`limit` menerima string query dan diubah ke integer (global
 * ValidationPipe memakai `transform: true` + `enableImplicitConversion`).
 * Invalid -> 400 `ERR_VALIDATION`.
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

// ---------------------------------------------------------------------------
// DTO respons (Swagger).
// ---------------------------------------------------------------------------

/** Satu baris activity log pada respons GET /v1/admin/activity-logs. */
export class ActivityLogDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID unik baris log',
  })
  id_log!: string;

  @ApiProperty({ example: 'musyrif1', description: 'Username pelaku' })
  username!: string;

  @ApiProperty({ enum: Role, example: Role.Musyrif, description: 'Role pelaku' })
  role!: Role;

  @ApiProperty({ example: 'Izin', description: 'Modul yang dicatat' })
  modul!: string;

  @ApiProperty({
    example: 'Memverifikasi izin 24050505050 menjadi Disetujui',
    description: 'Teks aktivitas eksplisit (maks 500 karakter)',
  })
  aktivitas!: string;

  @ApiProperty({
    example: '2026-10-18T10:00:00.000Z',
    description: 'Waktu pencatatan (UTC)',
  })
  created_at!: Date;
}

/** Info pagination pada respons GET /v1/admin/activity-logs. */
export class PaginationDto {
  @ApiProperty({ example: 1, description: 'Halaman saat ini (mulai 1)' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Jumlah log per halaman' })
  limit!: number;

  @ApiProperty({ example: 150, description: 'Total log yang cocok dengan filter' })
  total!: number;

  @ApiProperty({ example: 8, description: 'Jumlah total halaman' })
  total_pages!: number;
}

/** Respons sukses GET /v1/admin/activity-logs. */
export class ActivityLogsPageDto {
  @ApiProperty({ type: [ActivityLogDto], description: 'Daftar log (terbaru dulu)' })
  logs!: ActivityLogDto[];

  @ApiProperty({ type: PaginationDto, description: 'Info pagination' })
  pagination!: PaginationDto;
}

/**
 * GET /v1/admin/activity-logs — daftar activity log (BR-11).
 *
 * Hanya Admin. Log bersifat append-only: TIDAK ADA endpoint untuk
 * mengubah atau menghapus baris log. Terbaru dulu (`created_at` desc,
 * `id_log` desc sebagai tie-breaker). Filter: role/username/modul
 * (exact match) dan from/to (tanggal WIB `YYYY-MM-DD`, inklusif
 * sepanjang hari WIB). Pagination: `page` (mulai 1), `limit` (maks 100).
 * GET tidak pernah menciptakan log (endpoint ini tanpa `@Audit`).
 */
@ApiTags('Activity Log (Admin)')
@ApiBearerAuth('access-token')
@ApiExtraModels(ActivityLogDto, PaginationDto)
@Roles(Role.Admin)
@Controller('/admin/activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar activity log (append-only)',
    description:
      'Hanya Admin. Log bersifat append-only — tidak ada endpoint ' +
      'mengubah/menghapus. Urut terbaru dulu. Filter `role`, `username`, ' +
      '`modul` (exact match), `from`/`to` (tanggal WIB `YYYY-MM-DD`, ' +
      'inklusif). Pagination: `page` mulai 1, `limit` maksimum 100.',
  })
  @ApiOkResponse({
    description: 'Halaman activity log + info pagination',
    schema: successSchema(modelRef(ActivityLogsPageDto)),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async findAll(
    @Query() query: QueryActivityLogsDto,
  ): Promise<ActivityLogsPageDto> {
    return this.activityLogService.cari(query);
  }
}
