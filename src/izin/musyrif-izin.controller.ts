import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/enums';
import { Roles } from '@src/auth/decorators/roles.decorator';
import { Audit } from '@src/activity-log/activity-log.interceptor';
import { IzinService } from './izin.service';
import { QueryMusyrifIzinDto } from './dto/query-musyrif-izin.dto';
import { VerifyIzinDto } from './dto/verify-izin.dto';
import { IzinMusyrifDto } from './dto/izin.dto';
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

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      message: 'id_izin tidak valid',
      error: 'ERR_VALIDATION',
    }),
});

@ApiTags('Izin (Musyrif)')
@ApiBearerAuth('access-token')
@ApiExtraModels(IzinMusyrifDto)
@Roles(Role.Musyrif)
@Controller('musyrif/izin')
export class MusyrifIzinController {
  constructor(private readonly izinService: IzinService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar izin santri binaan',
    description:
      'Hanya Musyrif; hanya menampilkan izin dari mahasantri binaannya ' +
      '(selain itu 403 ERR_FORBIDDEN_ROLE). Opsional filter `status`.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Pending', 'Disetujui', 'Ditolak'],
    description: 'Filter status; kosongkan untuk semua status',
  })
  @ApiOkResponse({
    description: 'Daftar izin santri binaan (terbaru dulu)',
    schema: successSchema(arrayModelRef(IzinMusyrifDto)),
  })
  @ApiBadRequestResponse(validationResponse('status tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  async findAll(
    @Query() query: QueryMusyrifIzinDto,
    @Req() req: RequestWithUser,
  ): Promise<IzinMusyrifDto[]> {
    return this.izinService.findByMusyrif(req.user!.sub, query);
  }

  @Patch(':id_izin/verify')
  @HttpCode(HttpStatus.OK)
  @Audit(
    'Izin',
    (data) =>
      `Memverifikasi izin ${(data as IzinMusyrifDto).nim} menjadi ${
        (data as IzinMusyrifDto).status_persetujuan
      }`,
  )
  @ApiOperation({
    summary: 'Verifikasi izin (Disetujui/Ditolak)',
    description:
      'Hanya Musyrif pembina santri pengaju. 404 ERR_IZIN_NOT_FOUND bila izin ' +
      'tak ada; 403 ERR_NOT_YOUR_STUDENT bila bukan pembina; 409 ' +
      'ERR_IZIN_ALREADY_DECIDED bila bukan lagi Pending. Perubahan memakai ' +
      'update bersyarat pada status Pending sehingga aman dari dua verify ' +
      'bersamaan.',
  })
  @ApiParam({ name: 'id_izin', format: 'uuid' })
  @ApiOkResponse({
    description: 'Izin terverifikasi',
    schema: successSchema(
      modelRef(IzinMusyrifDto),
      HttpStatus.OK,
      'Verifikasi izin berhasil',
    ),
  })
  @ApiBadRequestResponse(validationResponse('id_izin atau body tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse({
    description:
      'Bukan musyrif pembina santri ini (ERR_NOT_YOUR_STUDENT) atau role tidak diizinkan (ERR_FORBIDDEN_ROLE)',
    schema: errorSchema({
      statusCode: 403,
      message: 'Anda bukan musyrif pembina dari mahasantri ini',
      error: 'ERR_NOT_YOUR_STUDENT',
    }),
  })
  @ApiNotFoundResponse({
    description: 'Izin tidak ditemukan (ERR_IZIN_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Izin tidak ditemukan',
      error: 'ERR_IZIN_NOT_FOUND',
    }),
  })
  @ApiConflictResponse({
    description: 'Izin sudah diputuskan (ERR_IZIN_ALREADY_DECIDED)',
    schema: errorSchema({
      statusCode: 409,
      message: 'Izin sudah pernah diputuskan dan tidak bisa diubah lagi',
      error: 'ERR_IZIN_ALREADY_DECIDED',
    }),
  })
  async verify(
    @Param('id_izin', uuidPipe) idIzin: string,
    @Body() dto: VerifyIzinDto,
    @Req() req: RequestWithUser,
  ): Promise<IzinMusyrifDto> {
    return this.izinService.verify(req.user!.sub, idIzin, dto);
  }
}
