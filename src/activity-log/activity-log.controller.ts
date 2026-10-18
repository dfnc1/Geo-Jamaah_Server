import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { ActivityLogService } from './activity-log.service';
import {
  ActivityLogDto,
  ActivityLogsPageDto,
  PaginationDto,
} from './dto/activity-log.dto';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';
import {
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

/**
 * GET /v1/admin/activity-logs — daftar activity log (BR-11).
 *
 * Hanya Admin. Log bersifat append-only: TIDAK ADA endpoint untuk
 * mengubah atau menghapus baris log. Terbaru dulu (`created_at` desc,
 * `id_log` desc sebagai tie-breaker). Filter: role/username/modul
 * (exact match) dan from/to (tanggal WIB `YYYY-MM-DD`, inklusif
 * sepanjang hari WIB). Pagination: `page` (mulai 1), `limit` (maks 100).
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
