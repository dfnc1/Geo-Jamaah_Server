import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import {
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
import { DssService } from './dss.service';
import { SantriKritisDto } from './dto/santri-kritis.dto';
import {
  arrayModelRef,
  errorSchema,
  forbiddenResponse,
  successSchema,
  unauthorizedResponse,
} from '@src/common/swagger/response-schemas';

/** Bentuk `req.user` yang diisi JwtStrategy. */
interface RequestWithUser {
  user?: { sub: string };
}

@ApiTags('DSS & EWS (Musyrif)')
@ApiBearerAuth('access-token')
@ApiExtraModels(SantriKritisDto)
@Roles(Role.Musyrif)
@Controller('musyrif/dss')
export class MusyrifDssController {
  constructor(private readonly dssService: DssService) {}

  @Get('santri-kritis')
  @ApiOperation({
    summary: 'Daftar santri kritis (DSS & EWS)',
    description:
      'Mahasantri binaan (`status_aktif = true`) yang berkategori KRITIS pada periode ' +
      '`DSS_PERIODE_HARI` hari terakhir termasuk hari ini (WIB, default 30): ' +
      'rasio kehadiran < 75% (setelah pembulatan satu desimal) ATAU streak `Tidak_Hadir` >= 3. ' +
      'Rasio = (`Hadir` + `Manual`) / (baris presensi tercatat dalam periode − `Izin`); ' +
      '`Izin` bukan alpha dan dikeluarkan dari penyebut. Hanya baris tercatat yang dihitung ' +
      '(tanpa data / penyebut 0 -> tidak muncul; respons selalu angka). ' +
      'Diurutkan rasio menaik, streak menurun, nim menaik; bisa `[]`.',
  })
  @ApiOkResponse({
    description: 'Daftar santri kritis (boleh kosong)',
    schema: successSchema(arrayModelRef(SantriKritisDto), HttpStatus.OK, 'Daftar santri kritis berhasil diambil'),
  })
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
  async findSantriKritis(
    @Req() req: RequestWithUser,
  ): Promise<SantriKritisDto[]> {
    return this.dssService.findSantriKritis(req.user!.sub);
  }
}
