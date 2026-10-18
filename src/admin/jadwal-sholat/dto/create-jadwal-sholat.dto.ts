import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { HH_MM_REGEX } from './presensi-window';

const HH_MM_MESSAGE = 'harus berformat HH:mm (24 jam), contoh 04:30';

export class CreateJadwalSholatDto {
  @ApiProperty({
    example: 'Subuh',
    description: 'Nama shalat (Subuh, Dzuhur, Ashar, Maghrib, Isya)',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'nama_sholat wajib diisi' })
  @IsString({ message: 'nama_sholat harus berupa teks' })
  // @IsNotEmpty hanya menolak ""; spasi saja tetap dianggap terisi.
  @Matches(/\S/, { message: 'nama_sholat wajib diisi' })
  @MaxLength(50, { message: 'nama_sholat maksimal 50 karakter' })
  nama_sholat!: string;

  @ApiProperty({ example: '04:30', description: 'Jam azan (WIB)' })
  @IsString({ message: 'waktu_azan harus berupa teks' })
  @Matches(HH_MM_REGEX, { message: `waktu_azan ${HH_MM_MESSAGE}` })
  waktu_azan!: string;

  @ApiProperty({ example: '04:45', description: 'Jam iqamah (WIB)' })
  @IsString({ message: 'waktu_iqamah harus berupa teks' })
  @Matches(HH_MM_REGEX, { message: `waktu_iqamah ${HH_MM_MESSAGE}` })
  waktu_iqamah!: string;

  @ApiProperty({
    example: '04:15',
    description: 'Awal window presensi (WIB), harus < waktu_akhir_presensi',
  })
  @IsString({ message: 'waktu_mulai_presensi harus berupa teks' })
  @Matches(HH_MM_REGEX, { message: `waktu_mulai_presensi ${HH_MM_MESSAGE}` })
  waktu_mulai_presensi!: string;

  @ApiProperty({
    example: '05:10',
    description: 'Akhir window presensi (WIB)',
  })
  @IsString({ message: 'waktu_akhir_presensi harus berupa teks' })
  @Matches(HH_MM_REGEX, { message: `waktu_akhir_presensi ${HH_MM_MESSAGE}` })
  waktu_akhir_presensi!: string;
}
