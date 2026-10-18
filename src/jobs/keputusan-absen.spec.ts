import { StatusPresensi } from '@generated/prisma/enums';
import { tentukanAbsensi } from './keputusan-absen';

describe('tentukanAbsensi (BR-05)', () => {
  it('tanpa presensi dan tanpa izin -> buat Tidak_Hadir', () => {
    expect(
      tentukanAbsensi({
        status_aktif: true,
        punya_presensi: false,
        ada_izin_disetujui: false,
      }),
    ).toEqual({ aksi: 'buat', status: StatusPresensi.Tidak_Hadir });
  });

  it('ada izin Disetujui -> buat Izin', () => {
    expect(
      tentukanAbsensi({
        status_aktif: true,
        punya_presensi: false,
        ada_izin_disetujui: true,
      }),
    ).toEqual({ aksi: 'buat', status: StatusPresensi.Izin });
  });

  it('izi masih Pending/Ditolak dianggap tidak ada izin -> Tidak_Hadir', () => {
    // Service hanya mengirim true untuk Disetujui; Pending/Ditolak dipetakan
    // ke false sehingga hasilnya Tidak_Hadir.
    expect(
      tentukanAbsensi({
        status_aktif: true,
        punya_presensi: false,
        ada_izin_disetujui: false,
      }).aksi,
    ).toBe('buat');
  });

  it('sudah Hadir (punya presensi) -> lewati, tidak diubah', () => {
    expect(
      tentukanAbsensi({
        status_aktif: true,
        punya_presensi: true,
        ada_izin_disetujui: true,
      }),
    ).toEqual({ aksi: 'lewati', alasan: 'sudah_ada_presensi' });
  });

  it('santri nonaktif -> dilewati meski tanpa presensi', () => {
    expect(
      tentukanAbsensi({
        status_aktif: false,
        punya_presensi: false,
        ada_izin_disetujui: false,
      }),
    ).toEqual({ aksi: 'lewati', alasan: 'nonaktif' });
  });
});
