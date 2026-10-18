import { ApiProperty } from '@nestjs/swagger';
import { JenisIzin } from '@generated/prisma/enums';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateIzinDto {
  @ApiProperty({
    enum: JenisIzin,
    example: JenisIzin.Sakit,
    description: 'Jenis izin: Sakit, Pulang, atau Tugas_Kampus',
  })
  @IsEnum(JenisIzin, {
    message: `jenis_izin harus salah satu dari: ${Object.values(JenisIzin).join(', ')}`,
  })
  jenis_izin!: JenisIzin;

  @ApiProperty({
    example: '2026-10-05',
    description:
      'Tanggal izin berformat YYYY-MM-DD (WIB). Tanggal lampau masih boleh (izin menyusul).',
  })
  // Format tanggal saja (tanpa jam): IsDateString sendiri menerima datetime.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'tanggal_izin harus berformat YYYY-MM-DD, contoh 2026-10-05',
  })
  // strict menolak tanggal kalender yang tidak ada, mis. 2026-02-30.
  @IsDateString(
    { strict: true },
    { message: 'tanggal_izin bukan tanggal yang valid' },
  )
  tanggal_izin!: string;

  @ApiProperty({
    example: 'Sakit demam, sudah ke puskesmas',
    description: 'Alasan izin, maksimal 500 karakter',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'alasan wajib diisi' })
  @IsString({ message: 'alasan harus berupa teks' })
  // @IsNotEmpty hanya menolak ""; spasi saja tetap dianggap terisi.
  @Matches(/\S/, { message: 'alasan wajib diisi' })
  @MaxLength(500, { message: 'alasan maksimal 500 karakter' })
  alasan!: string;

  @ApiProperty({
    example: 'izin/24050505050/2026-10-05.jpg',
    description:
      'Opsional. Object key lampiran (string); upload file/belum ada MinIO pada tahap ini. Jangan kirim bila tidak ada.',
    required: false,
    maxLength: 255,
  })
  // @IsOptional melewatkan null juga; di sini null harus ditolak 400 —
  // cukup tidak dikirim bila tidak ada lampiran.
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString({ message: 'bukti_lampiran harus berupa teks' })
  @MaxLength(255, { message: 'bukti_lampiran maksimal 255 karakter' })
  bukti_lampiran?: string;
}
