import { ApiProperty } from '@nestjs/swagger';

/** Satu hari pada respons tren kehadiran. */
export class TrenHarianDto {
  @ApiProperty({ example: '2026-10-18', description: 'Tanggal WIB (YYYY-MM-DD)' })
  tanggal!: string;

  @ApiProperty({ example: 10, description: 'Jumlah baris Hadir + Manual' })
  hadir!: number;

  @ApiProperty({ example: 2, description: 'Jumlah baris Tidak_Hadir' })
  tidak_hadir!: number;

  @ApiProperty({ example: 1, description: 'Jumlah baris Izin (dikeluarkan dari penyebut rasio)' })
  izin!: number;

  @ApiProperty({ example: 0, description: 'Jumlah baris Manual (dihitung hadir)' })
  manual!: number;

  @ApiProperty({ example: 13, description: 'Total baris presensi hari ini' })
  total!: number;

  @ApiProperty({
    example: 76.9,
    description:
      'hadir / (hadir + tidak_hadir) * 100, satu desimal; null bila penyebut 0',
    nullable: true,
  })
  persen_hadir: number | null;
}

/** Respons GET /v1/musyrif/dashboard/tren-kehadiran dan /v1/admin/dashboard/tren-kehadiran. */
export class TrenKehadiranResponseDto {
  @ApiProperty({ example: 7, description: 'Jumlah hari yang ditampilkan' })
  hari!: number;

  @ApiProperty({
    example: '2026-10-18',
    description: 'Tanggal awal periode (WIB)',
  })
  tanggal_mulai!: string;

  @ApiProperty({
    example: '2026-10-24',
    description: 'Tanggal akhir periode = hari ini (WIB)',
  })
  tanggal_akhir!: string;

  @ApiProperty({ type: [TrenHarianDto], description: 'Tren per hari, urut tanggal menaik' })
  data!: TrenHarianDto[];
}
