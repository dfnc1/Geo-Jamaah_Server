import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusPersetujuan } from '@generated/prisma/enums';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryMusyrifIzinDto {
  @ApiPropertyOptional({
    enum: StatusPersetujuan,
    example: StatusPersetujuan.Pending,
    description:
      'Filter status; kosongkan untuk menampilkan semua izin santri binaan.',
  })
  @IsOptional()
  @IsEnum(StatusPersetujuan, {
    message: `status harus salah satu dari: ${Object.values(StatusPersetujuan).join(', ')}`,
  })
  status?: StatusPersetujuan;
}
