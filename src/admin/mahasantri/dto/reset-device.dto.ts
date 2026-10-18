import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respons POST /v1/admin/mahasantri/:nim/reset-device. */
export class ResetDeviceResponseDto {
  @ApiProperty({ example: '24050505050' })
  nim!: string;

  @ApiProperty({ example: 'santri_satu' })
  nama!: string;

  @ApiProperty({ example: 'ahmad_fauzi', description: 'Username pengguna terkait' })
  username!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: null,
    description:
      'device_id setelah direset. Selalu null; saat pengguna login kembali ' +
      'dari perangkat baru, device_id akan terikat ke perangkat itu.',
  })
  device_id!: string | null;
}
