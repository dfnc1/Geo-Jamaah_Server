import { ApiProperty } from '@nestjs/swagger';

/** Bentuk data Masjid pada respons sukses. */
export class MasjidDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  id_masjid!: string;

  @ApiProperty({ example: 'Masjid Al-Ikhlas' })
  nama_masjid!: string;

  @ApiProperty({ example: -7.9666 })
  latitude!: number;

  @ApiProperty({ example: 112.6326 })
  longitude!: number;

  @ApiProperty({ example: 100, description: 'Dalam meter' })
  radius_toleransi!: number;
}

/** Respons DELETE /v1/admin/masjid/:id_masjid. */
export class DeleteMasjidResponseDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  id_masjid!: string;
}
