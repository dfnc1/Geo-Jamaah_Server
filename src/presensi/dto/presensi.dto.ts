import { ApiProperty } from '@nestjs/swagger';
import { StatusPresensi } from '@generated/prisma/enums';

/** Bentuk data presensi pada respons sukses POST /v1/presensi. */
export class PresensiDto {
  @ApiProperty({
    enum: StatusPresensi,
    example: StatusPresensi.Hadir,
    description: 'Selalu Hadir bila request diterima (lolos semua validasi)',
  })
  status_presensi!: StatusPresensi;

  @ApiProperty({
    example: 'Subuh',
    description: 'Nama jadwal sholat yang dipresensi (dari id_jadwal)',
  })
  nama_sholat!: string;

  @ApiProperty({
    example: 23.41,
    description:
      'Jarak Haversine dari posisi user ke masjid dalam meter, dibulatkan 2 desimal. Tidak disimpan ke database.',
  })
  jarak_meter!: number;
}
