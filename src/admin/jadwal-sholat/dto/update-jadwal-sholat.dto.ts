import { PartialType } from '@nestjs/swagger';
import { CreateJadwalSholatDto } from './create-jadwal-sholat.dto';

/**
 * PATCH: semua field jadi opsional. `skipNullProperties: false` membuat
 * nilai `null` tetap divalidasi (ditolak) alih-alih lolos tanpa cek.
 *
 * Validasi lintas-field window presensi (`mulai < akhir`) dilakukan di
 * JadwalSholatService memakai nilai gabungan dengan data tersimpan,
 * karena aturan itu tidak bisa dievaluasi dari satu field saja.
 */
export class UpdateJadwalSholatDto extends PartialType(
  CreateJadwalSholatDto,
  { skipNullProperties: false },
) {}
