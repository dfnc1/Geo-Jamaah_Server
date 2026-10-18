import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreatePresensiDto {
  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000001',
    description: 'Jadwal sholat yang diikuti (waktu presensi harus dalam window jadwal ini)',
    format: 'uuid',
  })
  @IsUUID('all', { message: 'id_jadwal tidak valid' })
  id_jadwal!: string;

  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000002',
    description: 'Masjid tempat presensi (dipakai untuk perhitungan radius geofence)',
    format: 'uuid',
  })
  @IsUUID('all', { message: 'id_masjid tidak valid' })
  id_masjid!: string;

  @ApiProperty({
    example: -7.9671,
    minimum: -90,
    maximum: 90,
    description: 'Lintang posisi user saat ini dalam derajat (-90..90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude_user harus berupa angka' })
  @Min(-90, { message: 'latitude_user harus antara -90 dan 90' })
  @Max(90, { message: 'latitude_user harus antara -90 dan 90' })
  latitude_user!: number;

  @ApiProperty({
    example: 112.6326,
    minimum: -180,
    maximum: 180,
    description: 'Bujur posisi user saat ini dalam derajat (-180..180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude_user harus berupa angka' })
  @Min(-180, { message: 'longitude_user harus antara -180 dan 180' })
  @Max(180, { message: 'longitude_user harus antara -180 dan 180' })
  longitude_user!: number;

  @ApiProperty({
    example: 12.5,
    minimum: 0,
    description:
      'Akurasi GPS dalam meter (dari Geolocation API). Wajib; nilai > 50 ditolak (ERR_GPS_ACCURACY_LOW)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'akurasi_meter harus berupa angka' })
  @Min(0, { message: 'akurasi_meter tidak boleh negatif' })
  akurasi_meter!: number;

  @ApiProperty({
    example: false,
    description:
      'true bila lokasi berasal dari mock/fake GPS. Wajib dikirim; true ditolak (ERR_MOCK_LOCATION)',
  })
  @IsBoolean({ message: 'is_mock_location harus berupa boolean' })
  is_mock_location!: boolean;
}
