import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

/** Body opsional untuk pemicu manual `POST /v1/admin/jobs/tandai-tidak-hadir`. */
export class RunTandaiTidakHadirDto {
  @ApiPropertyOptional({
    example: '2026-10-17',
    description:
      'Tanggal WIB (YYYY-MM-DD) yang diproses; default hari ini. Tidak boleh melebihi hari ini. Tanggal lampau = backfill.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'tanggal harus berformat YYYY-MM-DD, contoh 2026-10-17',
  })
  @IsDateString(
    { strict: true },
    { message: 'tanggal bukan tanggal yang valid' },
  )
  tanggal?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '00000000-0000-4000-8000-000000000003',
    description:
      'Proses satu jadwal sholat saja; default semua jadwal yang waktu akhir presensinya sudah lewat.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'id_jadwal harus berupa UUID yang valid' })
  id_jadwal?: string;
}
