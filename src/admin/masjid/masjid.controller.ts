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
import { Audit } from '@src/activity-log/audit.decorator';
import { MasjidService } from './masjid.service';
import { CreateMasjidDto } from './dto/create-masjid.dto';
import { UpdateMasjidDto } from './dto/update-masjid.dto';
import { DeleteMasjidResponseDto, MasjidDto } from './dto/masjid.dto';
import {
  arrayModelRef,
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

@ApiTags('Admin - Masjid')
@ApiBearerAuth('access-token')
@ApiExtraModels(MasjidDto, DeleteMasjidResponseDto)
@Roles(Role.Admin)
@Controller('/admin/masjid')
export class MasjidController {
  constructor(private readonly masjidService: MasjidService) {}

  @Post()
  @Audit('Masjid', 'membuat-masjid')
  @ApiOperation({
    summary: 'Tambah masjid',
    description:
      'Hanya Admin. `nama_masjid` wajib, `latitude` -90..90, `longitude` -180..180, `radius_toleransi` > 0 (meter).',
  })
  @ApiCreatedResponse({
    description: 'Masjid dibuat',
    schema: successSchema(modelRef(MasjidDto), HttpStatus.CREATED, 'Masjid berhasil ditambahkan'),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async create(@Body() dto: CreateMasjidDto): Promise<MasjidDto> {
    return this.masjidService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar semua masjid',
    description: 'Hanya Admin. Diurutkan berdasarkan nama masjid.',
  })
  @ApiOkResponse({
    description: 'Daftar masjid',
    schema: successSchema(arrayModelRef(MasjidDto)),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async findAll(): Promise<MasjidDto[]> {
    return this.masjidService.findAll();
  }

  @Get(':id_masjid')
  @ApiOperation({ summary: 'Detail satu masjid', description: 'Hanya Admin.' })
  @ApiParam({ name: 'id_masjid', format: 'uuid' })
  @ApiOkResponse({
    description: 'Detail masjid',
    schema: successSchema(modelRef(MasjidDto)),
  })
  @ApiBadRequestResponse(validationResponse('id_masjid tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Masjid tidak ditemukan (ERR_MASJID_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Masjid tidak ditemukan',
      error: 'ERR_MASJID_NOT_FOUND',
    }),
  })
  async findOne(@Param('id_masjid') idMasjid: string): Promise<MasjidDto> {
    return this.masjidService.findOne(idMasjid);
  }

  @Patch(':id_masjid')
  @Audit('Masjid', 'mengubah-masjid')
  @ApiOperation({
    summary: 'Ubah data masjid',
    description:
      'Hanya Admin. Semua field bersifat opsional (PATCH); field yang tidak dikirim tetap seperti semula.',
  })
  @ApiParam({ name: 'id_masjid', format: 'uuid' })
  @ApiOkResponse({
    description: 'Masjid diperbarui',
    schema: successSchema(modelRef(MasjidDto), HttpStatus.OK, 'Masjid berhasil diperbarui'),
  })
  @ApiBadRequestResponse(validationResponse())
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Masjid tidak ditemukan (ERR_MASJID_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Masjid tidak ditemukan',
      error: 'ERR_MASJID_NOT_FOUND',
    }),
  })
  async update(
    @Param('id_masjid') idMasjid: string,
    @Body() dto: UpdateMasjidDto,
  ): Promise<MasjidDto> {
    return this.masjidService.update(idMasjid, dto);
  }

  @Delete(':id_masjid')
  @HttpCode(HttpStatus.OK)
  @Audit('Masjid', 'menghapus-masjid')
  @ApiOperation({
    summary: 'Hapus masjid',
    description:
      'Hanya Admin. Hard delete. Ditolak 409 ERR_IN_USE bila masih dipakai oleh data presensi.',
  })
  @ApiParam({ name: 'id_masjid', format: 'uuid' })
  @ApiOkResponse({
    description: 'Masjid dihapus',
    schema: successSchema(
      modelRef(DeleteMasjidResponseDto),
      HttpStatus.OK,
      'Masjid berhasil dihapus',
    ),
  })
  @ApiBadRequestResponse(validationResponse('id_masjid tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Masjid tidak ditemukan (ERR_MASJID_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Masjid tidak ditemukan',
      error: 'ERR_MASJID_NOT_FOUND',
    }),
  })
  @ApiConflictResponse({
    description: 'Masjid masih dipakai presensi (ERR_IN_USE)',
    schema: errorSchema({
      statusCode: 409,
      message: 'Masjid masih dipakai oleh data presensi, tidak bisa dihapus',
      error: 'ERR_IN_USE',
    }),
  })
  async remove(
    @Param('id_masjid') idMasjid: string,
  ): Promise<DeleteMasjidResponseDto> {
    return this.masjidService.remove(idMasjid);
  }
}
