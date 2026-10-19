import { ApiProperty } from '@nestjs/swagger';

/** Jumlah presensi per status dalam periode. */
export class RekapStatusPresensiDto {
  @ApiProperty({ example: 28, description: 'Jumlah baris Hadir + Manual' })
  hadir!: number;

  @ApiProperty({ example: 5, description: 'Jumlah baris Tidak_Hadir' })
  tidak_hadir!: number;

  @ApiProperty({ example: 3, description: 'Jumlah baris Izin' })
  izin!: number;

  @ApiProperty({ example: 0, description: 'Jumlah baris Manual' })
  manual!: number;

  @ApiProperty({ example: 36, description: 'Total baris presensi dalam periode' })
  total!: number;
}

/** Jumlah izin per status persetujuan. */
export class RekapStatusIzinDto {
  @ApiProperty({ example: 10, description: 'Jumlah izin Pending' })
  pending!: number;

  @ApiProperty({ example: 4, description: 'Jumlah izin Disetujui' })
  disetujui!: number;

  @ApiProperty({ example: 1, description: 'Jumlah izin Ditolak' })
  ditolak!: number;

  @ApiProperty({ example: 15, description: 'Total izin' })
  total!: number;
}

/** Respons GET /v1/admin/rekap. */
export class RekapResponseDto {
  @ApiProperty({ example: 3, description: 'Jumlah Mahasantri status_aktif = true' })
  jumlah_santri_aktif!: number;

  @ApiProperty({ type: RekapStatusPresensiDto, description: 'Jumlah presensi per status (Manual masuk hadir)' })
  presensi!: RekapStatusPresensiDto;

  @ApiProperty({ type: RekapStatusIzinDto, description: 'Jumlah izin per status persetujuan' })
  izin!: RekapStatusIzinDto;

  @ApiProperty({ example: 0, description: 'Jumlah santri kritis (DSS/EWS)' })
  jumlah_santri_kritis!: number;
}
