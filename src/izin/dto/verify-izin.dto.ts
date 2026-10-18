import { ApiProperty } from '@nestjs/swagger';
import { StatusPersetujuan } from '@generated/prisma/enums';
import { IsIn } from 'class-validator';

/** Hanya Disetujui/Ditolak; `Pending` ditolak karena verify = memutuskan (BR-07). */
const STATUS_VERIFY = [
  StatusPersetujuan.Disetujui,
  StatusPersetujuan.Ditolak,
] as const;

export class VerifyIzinDto {
  @ApiProperty({
    enum: STATUS_VERIFY,
    example: StatusPersetujuan.Disetujui,
    description:
      'Hasil verifikasi: Disetujui atau Ditolak. Izin harus masih Pending.',
  })
  @IsIn(STATUS_VERIFY, {
    message: `status_persetujuan harus salah satu dari: ${STATUS_VERIFY.join(', ')}`,
  })
  status_persetujuan!: (typeof STATUS_VERIFY)[number];
}
