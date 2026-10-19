import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { Audit } from '@src/activity-log/activity-log.interceptor';
import { IzinService } from './izin.service';
import { CreateIzinDto } from './dto/create-izin.dto';
import { IzinDto } from './dto/izin.dto';
import {
  arrayModelRef,
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

@ApiTags('Izin (Mahasantri)')
@ApiBearerAuth('access-token')
@ApiExtraModels(IzinDto)
@Roles(Role.Mahasantri)
@Controller('izin')
export class IzinController {
  constructor(private readonly izinService: IzinService) {}

  @Post()
  @Audit('Izin', (data) => {
    const r = data as IzinDto;
    // Menerima Date (bentuk mentah Prisma) maupun string ISO; keduanya
    // dipotong ke YYYY-MM-DD.
    const iso =
      r.tanggal_izin instanceof Date
        ? r.tanggal_izin.toISOString()
        : String(r.tanggal_izin);
    return `Mengajukan izin ${r.jenis_izin} tanggal ${iso.slice(0, 10)}`;
  })
  @ApiOperation({
    summary: 'Ajukan izin',
    description:
      'Hanya Mahasantri. `id_musyrif` diisi otomatis dari Musyrif pembina; ' +
      'status awal selalu `Pending`. `bukti_lampiran` string opsional ' +
      '(upload lampiran/MinIO belum tersedia). Tanggal lampau masih diizinkan.',
  })
  @ApiCreatedResponse({
    description: 'Pengajuan izin diterima',
    schema: successSchema(
      modelRef(IzinDto),
      HttpStatus.CREATED,
      'Pengajuan izin berhasil dikirim',
    ),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Profil Mahasantri tidak ditemukan (ERR_MAHASANTRI_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Data mahasantri tidak ditemukan',
      error: 'ERR_MAHASANTRI_NOT_FOUND',
    }),
  })
  async create(
    @Body() dto: CreateIzinDto,
    @Req() req: RequestWithUser,
  ): Promise<IzinDto> {
    return this.izinService.create(req.user!.sub, dto);
  }

  @Get('saya')
  @ApiOperation({
    summary: 'Daftar izin milik sendiri',
    description:
      'Hanya Mahasantri. Diurutkan terbaru dulu (tanggal_izin menurun).',
  })
  @ApiOkResponse({
    description: 'Daftar izin milik pengguna',
    schema: successSchema(arrayModelRef(IzinDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async findSaya(@Req() req: RequestWithUser): Promise<IzinDto[]> {
    return this.izinService.findSaya(req.user!.sub);
  }
}
