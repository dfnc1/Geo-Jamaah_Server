import { ApiProperty } from '@nestjs/swagger';

/** Bentuk data JadwalSholat pada respons sukses. */
export class JadwalSholatDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000101' })
  id_jadwal!: string;

  @ApiProperty({ example: 'Subuh' })
  nama_sholat!: string;

  @ApiProperty({ example: '04:30', description: 'Format HH:mm (WIB)' })
  waktu_azan!: string;

  @ApiProperty({ example: '04:45', description: 'Format HH:mm (WIB)' })
  waktu_iqamah!: string;

  @ApiProperty({ example: '04:15', description: 'Format HH:mm (WIB)' })
  waktu_mulai_presensi!: string;

  @ApiProperty({ example: '05:10', description: 'Format HH:mm (WIB)' })
  waktu_akhir_presensi!: string;
}

/** Respons DELETE /v1/admin/jadwal-sholat/:id_jadwal. */
export class DeleteJadwalSholatResponseDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000101' })
  id_jadwal!: string;
}
