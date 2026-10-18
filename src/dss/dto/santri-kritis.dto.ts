import { ApiProperty } from '@nestjs/swagger';

/** Hitungan baris presensi dalam periode per status (Manual masuk `hadir`). */
export class JumlahPresensiDto {
  @ApiProperty({
    description: 'Jumlah baris Hadir + Manual dalam periode',
    example: 13,
  })
  hadir!: number;

  @ApiProperty({
    description: 'Jumlah baris Tidak_Hadir dalam periode',
    example: 6,
  })
  tidak_hadir!: number;

  @ApiProperty({
    description:
      'Jumlah baris Izin dalam periode — dikeluarkan dari penyebut rasio dan bukan alpha',
    example: 1,
  })
  izin!: number;
}

/** Satu Mahasantri kritis pada respons EWS. */
export class SantriKritisDto {
  @ApiProperty({ example: '24050505050' })
  nim!: string;

  @ApiProperty({ example: 'Ahmad Fauzi' })
  nama!: string;

  @ApiProperty({ enum: ['KRITIS'], example: 'KRITIS' })
  kategori_risiko!: 'KRITIS';

  @ApiProperty({
    description:
      'Persen kehadiran 1 desimal, hasil pembulatan sebelum dibandingkan dengan 75',
    example: 61.5,
  })
  rasio_kehadiran!: number;

  @ApiProperty({
    description: 'Tidak_Hadir berturut-turut terbaru (0 bila tidak ada)',
    example: 0,
  })
  streak_alpha!: number;

  @ApiProperty({ type: JumlahPresensiDto })
  jumlah!: JumlahPresensiDto;

  @ApiProperty({
    description: 'Pemicu kategori, subset urut dari ["rasio", "streak"]',
    enum: ['rasio', 'streak'],
    isArray: true,
    example: ['rasio'],
  })
  alasan!: ('rasio' | 'streak')[];

  @ApiProperty({
    description: 'Tindakan yang disarankan server (aturan tetap, lihat BR-08)',
    example:
      'Lakukan pendampingan kehadiran dan bimbingan belajar terjadwal; evaluasi mingguan bersama mahasantri.',
  })
  rekomendasi_tindakan!: string;
}
