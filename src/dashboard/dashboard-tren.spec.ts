import { hitungTrenHarian } from './dashboard-tren';
import { toWibDate } from '@src/presensi/wib-time';

function baris(tanggal: string, status_presensi: string) {
  return { tanggal: toWibDate(new Date(tanggal + 'T00:00:00.000Z')), status_presensi };
}

describe('hitungTrenHarian (fungsi murni tren kehadiran)', () => {
  const mulai = toWibDate(new Date('2026-10-18T00:00:00.000Z')); // Minggu
  const akhir = toWibDate(new Date('2026-10-24T00:00:00.000Z')); // Sabtu (7 hari)

  it('hari tanpa data tetap muncul bernilai 0, persen_hadir null', () => {
    const hasil = hitungTrenHarian([], mulai, akhir);

    expect(hasil).toHaveLength(7);
    for (const h of hasil) {
      expect(h.hadir).toBe(0);
      expect(h.tidak_hadir).toBe(0);
      expect(h.izin).toBe(0);
      expect(h.manual).toBe(0);
      expect(h.total).toBe(0);
      expect(h.persen_hadir).toBeNull();
    }
  });

  it('campuran status: Manual dihitung hadir, Izin dikecualikan penyebut', () => {
    const hasil = hitungTrenHarian(
      [
        baris('2026-10-18', 'Hadir'),
        baris('2026-10-18', 'Manual'),
        baris('2026-10-18', 'Tidak_Hadir'),
        baris('2026-10-18', 'Izin'),
        baris('2026-10-18', 'Izin'),
      ],
      mulai,
      akhir,
    );

    const hariPertama = hasil[0];
    expect(hariPertama.tanggal).toBe('2026-10-18');
    expect(hariPertama.hadir).toBe(2); // Hadir + Manual
    expect(hariPertama.tidak_hadir).toBe(1);
    expect(hariPertama.izin).toBe(2);
    expect(hariPertama.total).toBe(5);
    // persen_hadir = 2 / (2 + 1) * 100 = 66.666... -> 66.7
    expect(hariPertama.persen_hadir).toBe(66.7);
  });

  it('penyebut nol (hanya Izin) -> persen_hadir null', () => {
    const hasil = hitungTrenHarian(
      [baris('2026-10-18', 'Izin'), baris('2026-10-18', 'Izin')],
      mulai,
      akhir,
    );

    expect(hasil[0].hadir).toBe(0);
    expect(hasil[0].tidak_hadir).toBe(0);
    expect(hasil[0].izin).toBe(2);
    expect(hasil[0].total).toBe(2);
    expect(hasil[0].persen_hadir).toBeNull();
  });

  it('pembulatan satu desimal: 1/3 -> 33.3, 2/3 -> 66.7, 3/4 -> 75.0', () => {
    const hasil = hitungTrenHarian(
      [
        baris('2026-10-18', 'Hadir'),
        baris('2026-10-18', 'Tidak_Hadir'),
        baris('2026-10-18', 'Tidak_Hadir'),
      ],
      mulai,
      akhir,
    );
    expect(hasil[0].persen_hadir).toBe(33.3);

    const hasil2 = hitungTrenHarian(
      [
        baris('2026-10-19', 'Hadir'),
        baris('2026-10-19', 'Hadir'),
        baris('2026-10-19', 'Tidak_Hadir'),
        baris('2026-10-19', 'Tidak_Hadir'),
      ],
      mulai,
      akhir,
    );
    expect(hasil2[1].persen_hadir).toBe(50.0);
  });

  it('batas hari WIB: baris di luar rentang tidak dihitung', () => {
    const hasil = hitungTrenHarian(
      [
        baris('2026-10-17', 'Hadir'), // sebelum mulai
        baris('2026-10-18', 'Hadir'), // di dalam
        baris('2026-10-24', 'Hadir'), // di dalam (akhir)
        baris('2026-10-25', 'Hadir'), // setelah akhir
      ],
      mulai,
      akhir,
    );

    expect(hasil[0].tanggal).toBe('2026-10-18');
    expect(hasil[0].hadir).toBe(1);
    expect(hasil[6].tanggal).toBe('2026-10-24');
    expect(hasil[6].hadir).toBe(1);
    // 2026-10-17 dan 2026-10-25 tidak ada di hasil
    expect(hasil.some((h) => h.tanggal === '2026-10-17')).toBe(false);
    expect(hasil.some((h) => h.tanggal === '2026-10-25')).toBe(false);
  });

  it('rentang 1 hari (mulai = akhir)', () => {
    const satuHari = toWibDate(new Date('2026-10-20T00:00:00.000Z'));
    const hasil = hitungTrenHarian(
      [baris('2026-10-20', 'Hadir')],
      satuHari,
      satuHari,
    );

    expect(hasil).toHaveLength(1);
    expect(hasil[0].tanggal).toBe('2026-10-20');
    expect(hasil[0].hadir).toBe(1);
    expect(hasil[0].persen_hadir).toBe(100.0);
  });

  it('total = jumlah semua status', () => {
    const hasil = hitungTrenHarian(
      [
        baris('2026-10-18', 'Hadir'),
        baris('2026-10-18', 'Tidak_Hadir'),
        baris('2026-10-18', 'Izin'),
        baris('2026-10-18', 'Manual'),
      ],
      mulai,
      akhir,
    );

    expect(hasil[0].total).toBe(4);
    expect(hasil[0].persen_hadir).toBe(66.7); // 2 hadir (Hadir+Manual) / 3 (Hadir+Manual+Tidak_Hadir)
  });
});
