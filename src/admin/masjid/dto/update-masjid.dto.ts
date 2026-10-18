import { PartialType } from '@nestjs/swagger';
import { CreateMasjidDto } from './create-masjid.dto';

/**
 * PATCH: semua field jadi opsional. `skipNullProperties: false` membuat
 * nilai `null` tetap divalidasi (ditolak) alih-alih lolos tanpa cek.
 */
export class UpdateMasjidDto extends PartialType(CreateMasjidDto, {
  skipNullProperties: false,
}) {}
