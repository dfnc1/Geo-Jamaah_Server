import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { TandaiTidakHadirService } from './tandai-tidak-hadir.service';
import { RunTandaiTidakHadirDto } from './dto/run-tandai-tidak-hadir.dto';
import { HasilTandaiTidakHadirDto } from './dto/hasil-tandai.dto';
import {
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

@ApiTags('Jobs (Admin)')
@ApiBearerAuth('access-token')
@ApiExtraModels(HasilTandaiTidakHadirDto)
@Roles(Role.Admin)
@Controller('admin/jobs')
export class JobsController {
  constructor(
    private readonly tandaiTidakHadirService: TandaiTidakHadirService,
  ) {}

  @Post('tandai-tidak-hadir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Jalankan job Tidak_Hadir/Izin secara manual (demo)',
    description:
      'Hanya Admin. Menandai Mahasantri aktif yang belum presensi setelah ' +
      'window berakhir (BR-05): `Tidak_Hadir`, atau `Izin` bila ada Izin ' +
      'Disetujui pada tanggal itu. Idempoten — tidak menduplikat dan tidak ' +
      'menimpa presensi yang sudah ada. Job cron yang sama juga berjalan ' +
      'otomatis tiap menit setelah `waktu_akhir_presensi` (Asia/Jakarta); ' +
      'endpoint ini untuk pemicu manual/backfill.',
  })
  @ApiOkResponse({
    description: 'Job selesai; jumlah baris yang dibuat per status',
    schema: successSchema(
      modelRef(HasilTandaiTidakHadirDto),
      HttpStatus.OK,
      'Job selesai dijalankan',
    ),
  })
  @ApiBadRequestResponse(
    validationResponse(
      'tanggal/id_jadwal tidak valid, tanggal di masa depan, atau jadwal hari ini belum melewati waktu akhir (ERR_TIME_WINDOW_INVALID)',
    ),
  )
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description:
      'id_jadwal tidak ditemukan (ERR_JADWAL_NOT_FOUND) atau tidak ada data masjid (ERR_MASJID_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Jadwal sholat tidak ditemukan',
      error: 'ERR_JADWAL_NOT_FOUND',
    }),
  })
  async jalankan(
    @Body() dto: RunTandaiTidakHadirDto,
  ): Promise<HasilTandaiTidakHadirDto> {
    return this.tandaiTidakHadirService.jalankan(dto);
  }
}
