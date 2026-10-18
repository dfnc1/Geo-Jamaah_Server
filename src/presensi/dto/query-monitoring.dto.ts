import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

/**
 * Query `GET /v1/musyrif/presensi/monitoring`.
 * `tanggal` opsional: default hari ini WIB (dihitung server, bukan jam HP).
 */
export class QueryMonitoringDto {
  @ApiPropertyOptional({
    example: '2026-10-18',
    description:
      'Tanggal WIB (YYYY-MM-DD) yang dipantau; default hari ini (WIB). ' +
      'Tanggal lampau diperbolehkan (riwayat hari itu), tanggal masa depan ditolak 400 ERR_VALIDATION.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'tanggal harus berformat YYYY-MM-DD, contoh 2026-10-18',
  })
  @IsDateString(
    { strict: true },
    { message: 'tanggal bukan tanggal yang valid' },
  )
  tanggal?: string;
}
