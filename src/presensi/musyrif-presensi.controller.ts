import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
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
import { MusyrifPresensiService } from './musyrif-presensi.service';
import { QueryMonitoringDto } from './dto/query-monitoring.dto';
import { MonitoringResponseDto } from './dto/monitoring.dto';
import {
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

/** Bentuk `req.user` yang diisi JwtStrategy. */
interface RequestWithUser {
  user?: { sub: string };
}

@ApiTags('Monitoring (Musyrif)')
@ApiBearerAuth('access-token')
@ApiExtraModels(MonitoringResponseDto)
@Roles(Role.Musyrif)
@Controller('musyrif/presensi')
export class MusyrifPresensiController {
  constructor(private readonly musyrifPresensiService: MusyrifPresensiService) {}

  @Get('monitoring')
  @ApiOperation({
    summary: 'Monitoring presensi harian santri binaan',
    description:
      'Matriks status presensi per santri binaan (`status_aktif = true`) per jadwal sholat ' +
      'pada tanggal tertentu. `tanggal` format `YYYY-MM-DD` (WIB), default hari ini; tanggal ' +
      'masa depan ditolak 400 `ERR_VALIDATION`. Status sel: `Hadir`, `Tidak_Hadir`, `Izin`, ' +
      '`Manual`, atau `"Belum"` (belum ada baris presensi — termasuk jadwal yang window-nya ' +
      'belum lewat). Ringkasan di tingkat atas menghitung sel (santri × jadwal) per status. ' +
      'Maksimal 3 query (profil Musyrif, santri binaan, jadwal + presensi nested) tanpa N+1. ' +
      'Hanya santri binaan Musyrif token; bisa berupa `santri: []`.',
  })
  @ApiQuery({
    name: 'tanggal',
    required: false,
    example: '2026-10-18',
    description: 'Tanggal WIB (YYYY-MM-DD); default hari ini (WIB). Tanggal masa depan ditolak.',
  })
  @ApiOkResponse({
    description: 'Matriks monitoring tanggal tersebut (boleh tanpa santri)',
    schema: successSchema(
      modelRef(MonitoringResponseDto),
      HttpStatus.OK,
      'Monitoring presensi berhasil diambil',
    ),
  })
  @ApiBadRequestResponse(
    validationResponse(
      'Format tanggal salah atau tanggal masa depan (ERR_VALIDATION)',
    ),
  )
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Profil musyrif tidak ditemukan (ERR_MUSYRIF_NOT_FOUND, defensif)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Profil musyrif tidak ditemukan',
      error: 'ERR_MUSYRIF_NOT_FOUND',
    }),
  })
  async monitoring(
    @Req() req: RequestWithUser,
    @Query() query: QueryMonitoringDto,
  ): Promise<MonitoringResponseDto> {
    return this.musyrifPresensiService.monitoring(req.user!.sub, query);
  }
}
