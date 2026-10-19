import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { Audit } from '@src/activity-log/activity-log.interceptor';
import { JadwalSholatService } from './jadwal-sholat.service';
import { CreateJadwalSholatDto } from './dto/create-jadwal-sholat.dto';
import { UpdateJadwalSholatDto } from './dto/update-jadwal-sholat.dto';
import {
  DeleteJadwalSholatResponseDto,
  JadwalSholatDto,
} from './dto/jadwal-sholat.dto';
import {
  arrayModelRef,
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

const NOT_FOUND = {
  description: 'Jadwal sholat tidak ditemukan (ERR_JADWAL_NOT_FOUND)',
  schema: errorSchema({
    statusCode: 404,
    message: 'Jadwal sholat tidak ditemukan',
    error: 'ERR_JADWAL_NOT_FOUND',
  }),
};

@ApiTags('Admin - Jadwal Sholat')
@ApiBearerAuth('access-token')
@ApiExtraModels(JadwalSholatDto, DeleteJadwalSholatResponseDto)
@Roles(Role.Admin)
@Controller('/admin/jadwal-sholat')
export class JadwalSholatController {
  constructor(private readonly jadwalSholatService: JadwalSholatService) {}

  @Post()
  @Audit(
    'Jadwal',
    (data) => `Membuat jadwal sholat ${(data as JadwalSholatDto).nama_sholat}`,
  )
  @ApiOperation({
    summary: 'Tambah jadwal sholat',
    description:
      'Hanya Admin. `nama_sholat` wajib. Semua waktu wajib berformat HH:mm (24 jam) dan ' +
      '`waktu_mulai_presensi` < `waktu_akhir_presensi`.',
  })
  @ApiCreatedResponse({
    description: 'Jadwal sholat dibuat',
    schema: successSchema(
      modelRef(JadwalSholatDto),
      HttpStatus.CREATED,
      'Jadwal sholat berhasil ditambahkan',
    ),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async create(@Body() dto: CreateJadwalSholatDto): Promise<JadwalSholatDto> {
    return this.jadwalSholatService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar semua jadwal sholat',
    description: 'Hanya Admin. Diurutkan berdasarkan jam azan.',
  })
  @ApiOkResponse({
    description: 'Daftar jadwal sholat',
    schema: successSchema(arrayModelRef(JadwalSholatDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async findAll(): Promise<JadwalSholatDto[]> {
    return this.jadwalSholatService.findAll();
  }

  @Get(':id_jadwal')
  @ApiOperation({
    summary: 'Detail satu jadwal sholat',
    description: 'Hanya Admin.',
  })
  @ApiParam({ name: 'id_jadwal', format: 'uuid' })
  @ApiOkResponse({
    description: 'Detail jadwal sholat',
    schema: successSchema(modelRef(JadwalSholatDto)),
  })
  @ApiBadRequestResponse(validationResponse('id_jadwal tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse(NOT_FOUND)
  async findOne(
    @Param('id_jadwal') idJadwal: string,
  ): Promise<JadwalSholatDto> {
    return this.jadwalSholatService.findOne(idJadwal);
  }

  @Patch(':id_jadwal')
  @Audit(
    'Jadwal',
    (data) => `Mengubah jadwal sholat ${(data as JadwalSholatDto).id_jadwal}`,
  )
  @ApiOperation({
    summary: 'Ubah jadwal sholat',
    description:
      'Hanya Admin. Semua field opsional (PATCH). Aturan window presensi dievaluasi ' +
      'terhadap nilai gabungan dengan data tersimpan.',
  })
  @ApiParam({ name: 'id_jadwal', format: 'uuid' })
  @ApiOkResponse({
    description: 'Jadwal sholat diperbarui',
    schema: successSchema(
      modelRef(JadwalSholatDto),
      HttpStatus.OK,
      'Jadwal sholat berhasil diperbarui',
    ),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse(NOT_FOUND)
  async update(
    @Param('id_jadwal') idJadwal: string,
    @Body() dto: UpdateJadwalSholatDto,
  ): Promise<JadwalSholatDto> {
    return this.jadwalSholatService.update(idJadwal, dto);
  }

  @Delete(':id_jadwal')
  @HttpCode(HttpStatus.OK)
  @Audit(
    'Jadwal',
    (data) =>
      `Menghapus jadwal sholat ${(data as DeleteJadwalSholatResponseDto).id_jadwal}`,
  )
  @ApiOperation({
    summary: 'Hapus jadwal sholat',
    description:
      'Hanya Admin. Hard delete. Ditolak 409 ERR_IN_USE bila masih dipakai oleh data presensi.',
  })
  @ApiParam({ name: 'id_jadwal', format: 'uuid' })
  @ApiOkResponse({
    description: 'Jadwal sholat dihapus',
    schema: successSchema(
      modelRef(DeleteJadwalSholatResponseDto),
      HttpStatus.OK,
      'Jadwal sholat berhasil dihapus',
    ),
  })
  @ApiBadRequestResponse(validationResponse('id_jadwal tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiConflictResponse({
    description: 'Jadwal sholat masih dipakai presensi (ERR_IN_USE)',
    schema: errorSchema({
      statusCode: 409,
      message: 'Jadwal sholat masih dipakai oleh data presensi, tidak bisa dihapus',
      error: 'ERR_IN_USE',
    }),
  })
  async remove(
    @Param('id_jadwal') idJadwal: string,
  ): Promise<DeleteJadwalSholatResponseDto> {
    return this.jadwalSholatService.remove(idJadwal);
  }
}
