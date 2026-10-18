import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';

/** Satu baris activity log pada respons GET /v1/admin/activity-logs. */
export class ActivityLogDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID unik baris log',
  })
  id_log!: string;

  @ApiProperty({ example: 'musyrif1', description: 'Username pelaku' })
  username!: string;

  @ApiProperty({ enum: Role, example: Role.Musyrif, description: 'Role pelaku' })
  role!: Role;

  @ApiProperty({ example: 'Izin', description: 'Modul yang dicatat' })
  modul!: string;

  @ApiProperty({
    example: 'Memverifikasi izin 24050505050 menjadi Disetujui',
    description: 'Teks aktivitas eksplisit (maks 500 karakter)',
  })
  aktivitas!: string;

  @ApiProperty({
    example: '2026-10-18T10:00:00.000Z',
    description: 'Waktu pencatatan (UTC)',
  })
  created_at!: Date;
}

/** Info pagination pada respons GET /v1/admin/activity-logs. */
export class PaginationDto {
  @ApiProperty({ example: 1, description: 'Halaman saat ini (mulai 1)' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Jumlah log per halaman' })
  limit!: number;

  @ApiProperty({ example: 150, description: 'Total log yang cocok dengan filter' })
  total!: number;

  @ApiProperty({ example: 8, description: 'Jumlah total halaman' })
  total_pages!: number;
}

/** Respons sukses GET /v1/admin/activity-logs. */
export class ActivityLogsPageDto {
  @ApiProperty({ type: [ActivityLogDto], description: 'Daftar log (terbaru dulu)' })
  logs!: ActivityLogDto[];

  @ApiProperty({ type: PaginationDto, description: 'Info pagination' })
  pagination!: PaginationDto;
}
