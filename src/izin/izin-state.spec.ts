import { StatusPersetujuan } from '@generated/prisma/enums';
import { canTransition, IZIN_TRANSITIONS, isDecidable } from './izin-state';

describe('state machine izin (BR-07)', () => {
  describe('canTransition', () => {
    it('Pending -> Disetujui diizinkan', () => {
      expect(
        canTransition(
          StatusPersetujuan.Pending,
          StatusPersetujuan.Disetujui,
        ),
      ).toBe(true);
    });

    it('Pending -> Ditolak diizinkan', () => {
      expect(
        canTransition(StatusPersetujuan.Pending, StatusPersetujuan.Ditolak),
      ).toBe(true);
    });

    it('Disetujui -> Ditolak ditolak (keputusan sudah final)', () => {
      expect(
        canTransition(
          StatusPersetujuan.Disetujui,
          StatusPersetujuan.Ditolak,
        ),
      ).toBe(false);
    });

    it('Ditolak -> Disetujui ditolak (keputusan sudah final)', () => {
      expect(
        canTransition(
          StatusPersetujuan.Ditolak,
          StatusPersetujuan.Disetujui,
        ),
      ).toBe(false);
    });

    it('Disetujui -> Disetujui dan Ditolak -> Ditolak ditolak (idempoten tidak diizinkan)', () => {
      expect(
        canTransition(
          StatusPersetujuan.Disetujui,
          StatusPersetujuan.Disetujui,
        ),
      ).toBe(false);
      expect(
        canTransition(StatusPersetujuan.Ditolak, StatusPersetujuan.Ditolak),
      ).toBe(false);
    });

    it('Pending -> Pending ditolak (verify selalu memilih Disetujui/Ditolak)', () => {
      expect(
        canTransition(StatusPersetujuan.Pending, StatusPersetujuan.Pending),
      ).toBe(false);
    });
  });

  describe('isDecidable', () => {
    it('hanya Pending yang boleh diputuskan', () => {
      expect(isDecidable(StatusPersetujuan.Pending)).toBe(true);
      expect(isDecidable(StatusPersetujuan.Disetujui)).toBe(false);
      expect(isDecidable(StatusPersetujuan.Ditolak)).toBe(false);
    });
  });

  describe('tabel transisi', () => {
    it('menyediakan tepat dua tujuan untuk Pending dan nol untuk status final', () => {
      expect(IZIN_TRANSITIONS.Pending).toHaveLength(2);
      expect(IZIN_TRANSITIONS.Disetujui).toHaveLength(0);
      expect(IZIN_TRANSITIONS.Ditolak).toHaveLength(0);
    });
  });
});
