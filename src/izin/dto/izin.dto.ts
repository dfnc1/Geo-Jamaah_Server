import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JenisIzin, StatusPersetujuan } from '@generated/prisma/enums';

/** Bentuk data izin pada respons untuk Mahasantri (field polos). */
export class IzinDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-0000000000a1' })
  id_izin!: string;

  @ApiProperty({ example: '24050505050' })
  nim!: string;

  @ApiProperty({ enum: JenisIzin, example: JenisIzin.Sakit })
  jenis_izin!: JenisIzin;

  @ApiProperty({
    example: '2026-10-05T00:00:00.000Z',
    description:
      'Tanggal izin (tengah-malam UTC = tanggal WIB); pakai 10 karakter pertama di frontend.',
  })
  tanggal_izin!: Date;

  @ApiProperty({ example: 'Sakit demam, sudah ke puskesmas', maxLength: 500 })
  alasan!: string;

  @ApiPropertyOptional({
    example: 'izin/24050505050/2026-10-05.jpg',
    description: 'Object key lampiran; null bila tidak dikirim',
    nullable: true,
  })
  bukti_lampiran!: string | null;

  @ApiProperty({ enum: StatusPersetujuan, example: StatusPersetujuan.Pending })
  status_persetujuan!: StatusPersetujuan;
}

/** Izin untuk respons Musyrif: disertai nama santri pengaju. */
export class IzinMusyrifDto extends IzinDto {
  @ApiProperty({ example: 'santri_satu', description: 'Nama mahasantri pengaju' })
  nama_mahasantri!: string;
}
