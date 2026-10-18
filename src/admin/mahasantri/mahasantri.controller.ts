import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { MahasantriService } from './mahasantri.service';
import { ResetDeviceResponseDto } from './dto/reset-device.dto';
import {
  errorSchema,
  forbiddenResponse,
  modelRef,
  successSchema,
  unauthorizedResponse,
  validationResponse,
} from '@src/common/swagger/response-schemas';

@ApiTags('Admin - Mahasantri')
@ApiBearerAuth('access-token')
@ApiExtraModels(ResetDeviceResponseDto)
@Roles(Role.Admin)
@Controller('/admin/mahasantri')
export class MahasantriController {
  constructor(private readonly mahasantriService: MahasantriService) {}

  @Post(':nim/reset-device')
  @HttpCode(HttpStatus.OK)
  @Audit('Mahasantri', 'reset-device')
  @ApiOperation({
    summary: 'Reset device_id Mahasantri',
    description:
      'Hanya Admin. Menghapus `device_id` pengguna milik Mahasantri tersebut ' +
      '(di-set null) sehingga akun bisa diikat ulang ke perangkat baru. ' +
      'Login berikutnya dari perangkat baru akan mengikat device_id baru.',
  })
  @ApiParam({
    name: 'nim',
    description: 'NIM Mahasantri',
    example: '24050505050',
  })
  @ApiOkResponse({
    description: 'Device berhasil direset, `device_id` menjadi null',
    schema: successSchema(
      modelRef(ResetDeviceResponseDto),
      HttpStatus.OK,
      'Device ID berhasil direset',
    ),
  })
  @ApiBadRequestResponse(validationResponse('nim tidak valid'))
  @ApiUnauthorizedResponse(unauthorizedResponse())
  @ApiForbiddenResponse(forbiddenResponse())
  @ApiNotFoundResponse({
    description: 'Mahasantri tidak ditemukan (ERR_MAHASANTRI_NOT_FOUND)',
    schema: errorSchema({
      statusCode: 404,
      message: 'Mahasantri tidak ditemukan',
      error: 'ERR_MAHASANTRI_NOT_FOUND',
    }),
  })
  async resetDevice(
    @Param('nim') nim: string,
  ): Promise<ResetDeviceResponseDto> {
    return this.mahasantriService.resetDevice(nim);
  }
}
