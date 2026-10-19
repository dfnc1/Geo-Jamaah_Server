import { Body, Controller, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { Audit } from '@src/activity-log/activity-log.interceptor';
import { PresensiService } from './presensi.service';
import { CreatePresensiDto } from './dto/create-presensi.dto';
import { PresensiDto } from './dto/presensi.dto';
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

@ApiTags('Presensi')
@ApiBearerAuth('access-token')
@ApiExtraModels(PresensiDto)
@Roles(Role.Mahasantri)
@Controller('presensi')
export class PresensiController {
  constructor(private readonly presensiService: PresensiService) {}

  @Post()
  // Contoh BR-11: "Presensi Subuh berhasil, jarak 23 m" (jarak dibulatkan).
  @Audit(
    'Presensi',
    (data) =>
      `Presensi ${(data as PresensiDto).nama_sholat} berhasil, jarak ${Math.round(
        (data as PresensiDto).jarak_meter,
      )} m`,
  )
  @ApiOperation({
    summary: 'Catat presensi berbasis geolokasi',
    description:
      'Hanya Mahasantri. `nim` diambil dari token (sub), bukan dari body. ' +
      'Urutan validasi: mock location → akurasi GPS → jadwal/masjid ada → ' +
      'window time jam server WIB (inklusif di kedua batas) → radius Haversine ' +
      '(jarak ≤ radius diterima) → simpan. Presensi ganda per jadwal per hari ' +
      'ditolak 409 via unique constraint.',
  })
  @ApiCreatedResponse({
    description: 'Presensi berhasil dicatat',
    schema: successSchema(
      modelRef(PresensiDto),
      HttpStatus.CREATED,
      'Presensi berhasil dicatat',
    ),
  })
  @ApiBadRequestResponse({
    description:
      'Validasi body gagal (ERR_VALIDATION) atau request ditolak: ERR_MOCK_LOCATION, ERR_GPS_ACCURACY_LOW, ERR_TIME_WINDOW_INVALID, ERR_GEOFENCE_RADIUS_EXCEEDED',
    schema: errorSchema({
      statusCode: 400,
      message: 'Lokasi terdeteksi sebagai mock/Fake GPS, presensi ditolak',
      error: 'ERR_MOCK_LOCATION',
    }),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description:
      'Rujukan tidak ditemukan (ERR_JADWAL_NOT_FOUND / ERR_MASJID_NOT_FOUND / ERR_MAHASANTRI_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Jadwal sholat tidak ditemukan',
      error: 'ERR_JADWAL_NOT_FOUND',
    }),
  })
  @ApiConflictResponse({
    description: 'Sudah presensi untuk jadwal yang sama hari ini (ERR_ALREADY_PRESENT)',
    schema: errorSchema({
      statusCode: 409,
      message: 'Anda sudah melakukan presensi untuk jadwal ini hari ini',
      error: 'ERR_ALREADY_PRESENT',
    }),
  })
  async create(
    @Body() dto: CreatePresensiDto,
    @Req() req: RequestWithUser,
  ): Promise<PresensiDto> {
    return this.presensiService.create(req.user!.sub, dto);
  }
}
