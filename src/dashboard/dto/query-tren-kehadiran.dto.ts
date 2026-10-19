import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query parameter GET /v1/musyrif/dashboard/tren-kehadiran dan /v1/admin/dashboard/tren-kehadiran. */
export class QueryTrenKehadiranDto {
  @ApiPropertyOptional({
    example: 7,
    description: 'Jumlah hari terakhir (termasuk hari ini WIB), default 7, maksimal 30',
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 7 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(30)
  hari?: number;
}
