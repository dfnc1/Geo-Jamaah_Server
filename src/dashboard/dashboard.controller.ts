import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { QueryTrenKehadiranDto } from './dto/query-tren-kehadiran.dto';
import { TrenKehadiranResponseDto } from './dto/tren-kehadiran.dto';
import { RekapResponseDto } from './dto/rekap.dto';
import {
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
} from '@src/common/swagger/response-schemas';

/** Bentuk `req.user` yang diisi JwtStrategy. */
interface RequestWithUser {
  user?: { sub: string };
}

/**
 * Dashboard & Rekap (tahap 12).
 *
 * Endpoint:
 * - GET /v1/musyrif/dashboard/tren-kehadiran?hari=7  (Musyrif, binaan)
 * - GET /v1/admin/dashboard/tren-kehadiran?hari=7    (Admin, semua aktif)
 * - GET /v1/admin/rekap                              (Admin, rekap global)
 */
@Controller()
@ApiTags('Dashboard & Rekap')
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // -----------------------------------------------------------------------
  // GET /v1/musyrif/dashboard/tren-kehadiran?hari=7
  // -----------------------------------------------------------------------
  @Get('musyrif/dashboard/tren-kehadiran')
  @Roles(Role.Musyrif)
  @ApiOperation({
    summary: 'Tren kehadiran santri binaan Musyrif (grafik)',
    description:
      'Tren kehadiran per hari untuk Mahasantri binaan (`status_aktif = true`) ' +
      'pada `hari` terakhir termasuk hari ini (WIB). Query agregasi tunggal ' +
      '(groupBy tanggal + status), tanpa loop per hari. Hari tanpa data tetap ' +
      'muncul bernilai 0. persen_hadir = hadir / (hadir + tidak_hadir) * 100; ' +
      'Izin dikecualikan dari penyebut, Manual dihitung hadir; null bila ' +
      'penyebut 0.',
  })
  @ApiQuery({
    name: 'hari',
    required: false,
    example: 7,
    description: 'Jumlah hari (default 7, maksimal 30)',
  })
  @ApiOkResponse({
    description: 'Tren kehadiran per hari',
    schema: successSchema(modelRef(TrenKehadiranResponseDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Profil musyrif tidak ditemukan (ERR_MUSYRIF_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Profil musyrif tidak ditemukan',
      error: 'ERR_MUSYRIF_NOT_FOUND',
    }),
  })
  async trenKehadiranMusyrif(
    @Req() req: RequestWithUser,
    @Query() query: QueryTrenKehadiranDto,
  ): Promise<TrenKehadiranResponseDto> {
    return this.dashboardService.trenKehadiranMusyrif(req.user!.sub, query);
  }

  // -----------------------------------------------------------------------
  // GET /v1/admin/dashboard/tren-kehadiran?hari=7
  // -----------------------------------------------------------------------
  @Get('admin/dashboard/tren-kehadiran')
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Tren kehadiran semua Mahasantri aktif (grafik, Admin)',
    description:
      'Tren kehadiran per hari untuk semua Mahasantri aktif pada `hari` ' +
      'terakhir termasuk hari ini (WIB). Query agregasi tunggal, tanpa loop ' +
      'per hari. Hari tanpa data tetap muncul bernilai 0.',
  })
  @ApiQuery({
    name: 'hari',
    required: false,
    example: 7,
    description: 'Jumlah hari (default 7, maksimal 30)',
  })
  @ApiOkResponse({
    description: 'Tren kehadiran per hari (Admin)',
    schema: successSchema(modelRef(TrenKehadiranResponseDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async trenKehadiranAdmin(
    @Query() query: QueryTrenKehadiranDto,
  ): Promise<TrenKehadiranResponseDto> {
    return this.dashboardService.trenKehadiranAdmin(query);
  }

  // -----------------------------------------------------------------------
  // GET /v1/admin/rekap
  // -----------------------------------------------------------------------
  @Get('admin/rekap')
  @Roles(Role.Admin)
  @ApiOperation({
    summary: 'Rekap global Admin',
    description:
      'Jumlah Mahasantri aktif, jumlah presensi per status dalam periode, ' +
      'jumlah izin per status persetujuan, dan jumlah santri kritis (DSS/EWS).',
  })
  @ApiOkResponse({
    description: 'Rekap global',
    schema: successSchema(modelRef(RekapResponseDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async rekapAdmin(): Promise<RekapResponseDto> {
    return this.dashboardService.rekapAdmin();
  }
}
