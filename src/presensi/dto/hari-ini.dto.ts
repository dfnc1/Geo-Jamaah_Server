import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusPresensi } from '@generated/prisma/enums';

/** Status satu jadwal pada hari ini (union StatusPresensi + "Belum"). */
export type StatusHariIni =
  | 'Hadir'
  | 'Tidak_Hadir'
  | 'Izin'
  | 'Manual'
  | 'Belum';

/** Data masjid utama yang menjadi referensi presensi. */
export class MasjidHariIniDto {
  @ApiProperty({ example: 'uuid-masjid', description: 'ID masjid' })
  id_masjid!: string;

  @ApiProperty({ example: 'Masjid Al-Ikhlas', description: 'Nama masjid' })
  nama_masjid!: string;

  @ApiProperty({ example: -6.2146, description: 'Latitude masjid' })
  latitude!: number;

  @ApiProperty({ example: 106.8451, description: 'Longitude masjid' })
  longitude!: number;

  @ApiProperty({ example: 100, description: 'Radius toleransi geofence (meter)' })
  radius_toleransi!: number;
}

/** Satu jadwal sholat beserta status presensi dan window saat ini. */
export class JadwalHariIniDto {
  @ApiProperty({ example: 'uuid-jadwal', description: 'ID jadwal sholat' })
  id_jadwal!: string;

  @ApiProperty({ example: 'Subuh', description: 'Nama sholat' })
  nama_sholat!: string;

  @ApiProperty({ example: '04:30', description: 'Waktu azan (HH:mm WIB)' })
  waktu_azan!: string;

  @ApiProperty({ example: '04:35', description: 'Waktu iqamah (HH:mm WIB)' })
  waktu_iqamah!: string;

  @ApiProperty({
    example: '04:20',
    description: 'Waktu mulai window presensi (HH:mm WIB, inklusif)',
  })
  waktu_mulai_presensi!: string;

  @ApiProperty({
    example: '05:00',
    description: 'Waktu akhir window presensi (HH:mm WIB, inklusif)',
  })
  waktu_akhir_presensi!: string;

  @ApiProperty({
    enum: [...Object.values(StatusPresensi), 'Belum'],
    example: 'Belum',
    description:
      'Status presensi hari ini. "Belum" berarti belum ada baris presensi.',
  })
  status!: StatusHariIni;

  @ApiProperty({
    example: false,
    description:
      'true jika jam server WIB saat ini berada di dalam window presensi (inklusif di kedua batas). ' +
      'Gunakan ini untuk menampilkan tombol presensi.',
  })
  sedang_dalam_window!: boolean;
}

/** Respons GET /v1/presensi/hari-ini. */
export class HariIniResponseDto {
  @ApiProperty({
    example: '2026-10-24',
    description: 'Tanggal hari ini dalam zona WIB (YYYY-MM-DD)',
  })
  tanggal!: string;

  @ApiPropertyOptional({
    type: MasjidHariIniDto,
    nullable: true,
    description:
      'Masjid utama (deterministik: nama lalu id menaik). ' +
      'null jika belum ada masjid di database.',
  })
  masjid!: MasjidHariIniDto | null;

  @ApiProperty({
    type: [JadwalHariIniDto],
    description: 'Semua jadwal sholat hari ini, urut waktu_azan menaik.',
  })
  jadwal!: JadwalHariIniDto[];
}
