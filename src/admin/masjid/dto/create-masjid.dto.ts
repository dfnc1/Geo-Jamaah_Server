import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateMasjidDto {
  @ApiProperty({
    example: 'Masjid Al-Ikhlas',
    description: 'Nama masjid',
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'nama_masjid wajib diisi' })
  @IsString({ message: 'nama_masjid harus berupa teks' })
  // @IsNotEmpty hanya menolak ""; spasi saja tetap dianggap terisi.
  @Matches(/\S/, { message: 'nama_masjid wajib diisi' })
  @MaxLength(150, { message: 'nama_masjid maksimal 150 karakter' })
  nama_masjid!: string;

  @ApiProperty({
    example: -7.9666,
    minimum: -90,
    maximum: 90,
    description: 'Lintang lokasi masjid dalam derajat (-90..90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude harus berupa angka' })
  @Min(-90, { message: 'latitude harus antara -90 dan 90' })
  @Max(90, { message: 'latitude harus antara -90 dan 90' })
  latitude!: number;

  @ApiProperty({
    example: 112.6326,
    minimum: -180,
    maximum: 180,
    description: 'Bujur lokasi masjid dalam derajat (-180..180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude harus berupa angka' })
  @Min(-180, { message: 'longitude harus antara -180 dan 180' })
  @Max(180, { message: 'longitude harus antara -180 dan 180' })
  longitude!: number;

  @ApiProperty({
    example: 100,
    description: 'Radius toleransi presensi dalam meter, harus lebih dari 0',
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'radius_toleransi harus berupa angka' })
  @IsPositive({ message: 'radius_toleransi harus lebih dari 0' })
  radius_toleransi!: number;
}
