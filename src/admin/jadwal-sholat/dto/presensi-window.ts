import { BadRequestException } from '@nestjs/common';

/** Format jam 24 jam "HH:mm" (jam 00-23, menit 00-59). */
export const HH_MM_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Validasi lintas-field `waktu_mulai_presensi < waktu_akhir_presensi`.
 *
 * Dipanggil dari JadwalSholatService (create maupun update) karena decorator
 * lintas-field level kelas tidak diwarisi dengan benar oleh `PartialType`
 * pada DTO PATCH, sehingga pemeriksaan di DTO tidak akan pernah terjalankan.
 * Dengan pemeriksaan di service, PATCH sebagian tetap dicek memakai nilai
 * gabungan (field yang tidak dikirim diambil dari data tersimpan).
 *
 * Perbandingan string aman karena format "HH:mm" selalu zero-padded, sehingga
 * urutan leksikal = urutan kronologis.
 *
 * @throws BadRequestException 400 `ERR_VALIDATION` bila urutan tidak valid.
 */
export function assertPresensiWindowValid(
  waktuMulaiPresensi: string,
  waktuAkhirPresensi: string,
): void {
  if (!HH_MM_REGEX.test(waktuMulaiPresensi)) {
    throw new BadRequestException({
      message: `waktu_mulai_presensi ${waktuMulaiPresensi} harus berformat HH:mm (24 jam)`,
      error: 'ERR_VALIDATION',
    });
  }

  if (!HH_MM_REGEX.test(waktuAkhirPresensi)) {
    throw new BadRequestException({
      message: `waktu_akhir_presensi ${waktuAkhirPresensi} harus berformat HH:mm (24 jam)`,
      error: 'ERR_VALIDATION',
    });
  }

  if (waktuMulaiPresensi >= waktuAkhirPresensi) {
    throw new BadRequestException({
      message:
        `waktu_mulai_presensi (${waktuMulaiPresensi}) harus lebih kecil ` +
        `dari waktu_akhir_presensi (${waktuAkhirPresensi})`,
      error: 'ERR_VALIDATION',
    });
  }
}
