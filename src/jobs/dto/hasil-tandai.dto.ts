import { ApiProperty } from '@nestjs/swagger';

/** Jumlah baris presensi otomatis yang dibuat, per status. */
export class JumlahPerStatusDto {
  @ApiProperty({
    example: 2,
    description: 'Baris berstatus Tidak_Hadir yang berhasil dibuat',
  })
  Tidak_Hadir!: number;

  @ApiProperty({
    example: 1,
    description: 'Baris berstatus Izin (izin Disetujui) yang dibuat',
  })
  Izin!: number;
}

/** Respons pemicu manual `POST /v1/admin/jobs/tandai-tidak-hadir`. */
export class HasilTandaiTidakHadirDto {
  @ApiProperty({ example: '2026-10-18', description: 'Tanggal WIB (diproses)' })
  tanggal!: string;

  @ApiProperty({
    nullable: true,
    example: null,
    description:
      'UUID jadwal yang diproses; null = semua jadwal yang window-nya sudah lewat',
  })
  id_jadwal!: string | null;

  @ApiProperty({ type: JumlahPerStatusDto })
  dibuat!: JumlahPerStatusDto;

  @ApiProperty({ example: 3, description: 'Total baris yang dibuat' })
  total_dibuat!: number;
}
