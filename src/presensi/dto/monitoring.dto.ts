import { ApiProperty } from '@nestjs/swagger';
import { STATUS_MONITORING } from '../monitoring';

/** Satu kolom jadwal pada monitoring (header tabel). */
export class MonitoringJadwalDto {
  @ApiProperty({ format: 'uuid', example: '00000000-0000-4000-8000-000000000101' })
  id_jadwal!: string;

  @ApiProperty({ example: 'Subuh' })
  nama_sholat!: string;

  @ApiProperty({ example: '04:30', description: 'Azan (WIB)' })
  waktu_azan!: string;

  @ApiProperty({ example: '04:15', description: 'Awal window presensi (WIB)' })
  waktu_mulai_presensi!: string;

  @ApiProperty({ example: '05:10', description: 'Akhir window presensi (WIB)' })
  waktu_akhir_presensi!: string;
}

/** Status satu santri pada satu jadwal (`"Belum"` = belum ada baris presensi). */
export class MonitoringStatusDto {
  @ApiProperty({ format: 'uuid', example: '00000000-0000-4000-8000-000000000101' })
  id_jadwal!: string;

  @ApiProperty({ example: 'Subuh' })
  nama_sholat!: string;

  @ApiProperty({
    enum: STATUS_MONITORING,
    example: 'Hadir',
    description:
      'Hadir, Tidak_Hadir, Izin, Manual, atau "Belum" (belum ada baris presensi pada tanggal itu — termasuk jadwal yang window-nya belum lewat).',
  })
  status!: (typeof STATUS_MONITORING)[number];
}

/** Baris monitoring satu Mahasantri binaan aktif. */
export class MonitoringSantriDto {
  @ApiProperty({ example: '24050505050' })
  nim!: string;

  @ApiProperty({ example: 'santri_satu' })
  nama!: string;

  @ApiProperty({ example: 'A-12' })
  kamar!: string;

  @ApiProperty({
    type: [MonitoringStatusDto],
    description: 'Status per jadwal, urut sama dengan `jadwal` di tingkat atas',
  })
  status!: MonitoringStatusDto[];
}

/** Ringkasan jumlah sel (santri × jadwal) per status pada tanggal itu. */
export class RingkasanMonitoringDto {
  @ApiProperty({ example: 8 })
  Hadir!: number;

  @ApiProperty({ example: 2 })
  Tidak_Hadir!: number;

  @ApiProperty({ example: 1 })
  Izin!: number;

  @ApiProperty({ example: 0 })
  Manual!: number;

  @ApiProperty({ example: 4, description: 'Jadwal yang belum punya baris presensi' })
  Belum!: number;
}

/** Respons `GET /v1/musyrif/presensi/monitoring`. */
export class MonitoringResponseDto {
  @ApiProperty({ example: '2026-10-18', description: 'Tanggal WIB yang dipantau' })
  tanggal!: string;

  @ApiProperty({
    type: [MonitoringJadwalDto],
    description: 'Daftar jadwal sholat hari itu, urut waktu azan menaik',
  })
  jadwal!: MonitoringJadwalDto[];

  @ApiProperty({
    type: RingkasanMonitoringDto,
    description:
      'Jumlah sel per status; totalnya = jumlah santri × jumlah jadwal',
  })
  ringkasan!: RingkasanMonitoringDto;

  @ApiProperty({
    type: [MonitoringSantriDto],
    description: 'Santri binaan aktif, urut nim menaik; bisa kosong',
  })
  santri!: MonitoringSantriDto[];
}
