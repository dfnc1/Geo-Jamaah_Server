import {
  ATURAN_REKOMENDASI,
  BarisPresensi,
  evaluasiSantri,
  hitungRasio,
  hitungStreakAlpha,
  parsePeriodeHari,
  PERIODE_HARI_DEFAULT,
  rentangPeriode,
  rekomendasiTindakan,
  urutKronologis,
} from './ews';

/** Jam mulai presensi 5 jadwal seed (urut). */
const JAM = ['05:10', '12:30', '15:45', '18:10', '19:30'];

/** Bangun baris presensi: tanggal "YYYY-MM-DD" -> Date UTC tengah-malam. */
function baris(
  tanggal: string,
  status: string,
  idx = 0,
  nim = '24050505050',
): BarisPresensi {
  return {
    nim,
    tanggal: new Date(`${tanggal}T00:00:00.000Z`),
    status_presensi: status,
    id_jadwal: `jadwal-${idx}`,
    waktu_mulai: JAM[idx],
  };
}

/** Rentang tetap Oktober 2026 untuk tes filter periode. */
const OKTOBER = rentangPeriode(30, new Date('2026-10-30T12:00:00.000Z'));

describe('parsePeriodeHari', () => {
  it('bilangan bulat valid dipakai (termasuk spasi di sekelilingnya)', () => {
    expect(parsePeriodeHari('7')).toBe(7);
    expect(parsePeriodeHari(' 15 ')).toBe(15);
  });

  it.each([[undefined], [''], ['abc'], ['0'], ['-3'], ['2.5']])(
    'tidak valid "%s" -> memakai default',
    (raw) => {
      expect(parsePeriodeHari(raw)).toBe(PERIODE_HARI_DEFAULT);
    },
  );
});

describe('rentangPeriode', () => {
  it('batas akhir memakai tanggal WIB (toWibDate), bukan tanggal UTC proses', () => {
    // 2026-10-12T17:30Z = 2026-10-13 00:30 WIB -> hari ini menurut WIB
    // adalah 13 Oktober, bukan 12 Oktober (UTC).
    const rentang = rentangPeriode(7, new Date('2026-10-12T17:30:00.000Z'));

    expect(rentang.akhir.toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(rentang.mulai.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });

  it('N hari termasuk hari ini: jarak mulai-akhir = N-1 hari', () => {
    const rentang = rentangPeriode(30, new Date('2026-10-30T05:00:00.000Z'));
    const hari =
      (rentang.akhir.getTime() - rentang.mulai.getTime()) / 86_400_000 + 1;
    expect(hari).toBe(30);
  });
});

describe('hitungRasio', () => {
  it('tepat 75% bukan kritis (perbandingan setelah pembulatan 1 desimal)', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) =>
        baris('2026-10-15', 'Hadir', i % 5),
      ),
      baris('2026-10-15', 'Tidak_Hadir', 4),
      baris('2026-10-15', 'Tidak_Hadir', 3),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.rasio).toBe(75);
    expect(hasil.kategori).toBe('AMAN');
  });

  it('74,9% kritis karena rasio', () => {
    // 749 Hadir dari 1000 baris terhitung = 74,9%.
    const rows = [
      ...Array.from({ length: 749 }, (_, i) =>
        baris('2026-10-15', 'Hadir', i % 5),
      ),
      ...Array.from({ length: 251 }, (_, i) =>
        baris('2026-10-14', 'Tidak_Hadir', i % 5),
      ),
    ];
    // Baris terbaru Hadir supaya streak tidak ikut memicu.
    rows.push(baris('2026-10-16', 'Hadir', 0));

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.rasio).toBe(74.9);
    expect(hasil.kategori).toBe('KRITIS');
    expect(hasil.alasan).toEqual(['rasio']);
    expect(hasil.streak_alpha).toBe(0);
  });

  it('74,95% membulat menjadi 75,0 -> bukan kritis (bulat dulu, bandingkan sesudah)', () => {
    // 1499/2000 = 74,95% -> pembulatan 1 desimal = 75,0.
    const rows = [
      ...Array.from({ length: 1499 }, (_, i) =>
        baris('2026-10-15', 'Hadir', i % 5),
      ),
      ...Array.from({ length: 501 }, (_, i) =>
        baris('2026-10-14', 'Tidak_Hadir', i % 5),
      ),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.rasio).toBe(75);
    expect(hasil.kategori).toBe('AMAN');
  });

  it('Manual dihitung hadir (pembilang dan jumlah.hadir)', () => {
    const hasil = hitungRasio([
      baris('2026-10-15', 'Hadir'),
      baris('2026-10-15', 'Hadir', 1),
      baris('2026-10-15', 'Manual', 2),
      baris('2026-10-15', 'Tidak_Hadir', 3),
    ]);

    expect(hasil.jumlah).toEqual({ hadir: 3, tidak_hadir: 1, izin: 0 });
    expect(hasil.rasio).toBe(75);
  });

  it('Izin bukan alpha, tidak ikut penyebut, dan masuk jumlah.izin', () => {
    const rows = [
      baris('2026-10-15', 'Hadir'),
      baris('2026-10-15', 'Hadir', 1),
      baris('2026-10-15', 'Tidak_Hadir', 2),
      // Terbaru: Izin memutus streak dan dikeluarkan dari penyebut.
      baris('2026-10-16', 'Izin', 3),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.jumlah).toEqual({ hadir: 2, tidak_hadir: 1, izin: 1 });
    expect(hasil.rasio).toBe(66.7); // 2/3 — bukan 2/4
    // Izin terbaru memutus streak (bukan alpha).
    expect(hasil.streak_alpha).toBe(0);
  });

  it('dua alpha lalu Hadir: streak terputus menjadi 0', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => baris('2026-10-14', 'Hadir', i % 5)),
      baris('2026-10-15', 'Tidak_Hadir', 0),
      baris('2026-10-15', 'Tidak_Hadir', 1),
      baris('2026-10-16', 'Hadir', 0), // terbaru: memutus
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.streak_alpha).toBe(0);
    expect(hasil.kategori).toBe('AMAN');
    expect(hasil.rasio).toBe(86.7); // 13 hadir / 15 terhitung
  });

  it('tanpa baris sama sekali: rasio null, streak 0, AMAN', () => {
    const hasil = evaluasiSantri([], OKTOBER);

    expect(hasil).toEqual({
      kategori: 'AMAN',
      alasan: [],
      rasio: null,
      streak_alpha: 0,
      jumlah: { hadir: 0, tidak_hadir: 0, izin: 0 },
    });
  });

  it('hanya baris Izin: penyebut 0 -> rasio null (bukan 0%), bukan kritis', () => {
    const hasil = evaluasiSantri(
      [
        baris('2026-10-14', 'Izin'),
        baris('2026-10-15', 'Izin', 1),
        baris('2026-10-16', 'Izin', 2),
      ],
      OKTOBER,
    );

    expect(hasil.rasio).toBeNull();
    expect(hasil.streak_alpha).toBe(0);
    expect(hasil.jumlah.izin).toBe(3);
    expect(hasil.kategori).toBe('AMAN');
  });
});

describe('hitungStreakAlpha & urutKronologis', () => {
  it('tiga alpha berturut lintas hari dan lintas jadwal -> kritis karena streak', () => {
    // Input sengaja tidak berurutan; urutan diurungkan fungsi.
    const rows = [
      baris('2026-10-16', 'Tidak_Hadir', 0), // terbaru
      baris('2026-10-14', 'Hadir', 1),
      baris('2026-10-16', 'Tidak_Hadir', 1),
      baris('2026-10-15', 'Tidak_Hadir', 2),
      baris('2026-10-14', 'Hadir', 0),
      baris('2026-10-14', 'Hadir', 2),
      // Sisanya Hadir biar rasio tetap >= 75 (streak-saja).
      ...Array.from({ length: 9 }, (_, i) =>
        baris('2026-10-13', 'Hadir', i % 5),
      ),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.streak_alpha).toBe(3);
    expect(hasil.alasan).toEqual(['streak']);
    expect(hasil.rasio).toBe(80); // 12 hadir / 15 terhitung
    expect(hasil.kategori).toBe('KRITIS');
  });

  it('seri tanggal dan waktu dipatahkan id_jadwal menaik', () => {
    // Dua baris pada hari + jam yang sama, beda jadwal: 'a' (Hadir) harus
    // mendahului 'b' (Tidak_Hadir), sehingga yang terbaru adalah 'b'.
    const rows = [
      { ...baris('2026-10-16', 'Tidak_Hadir', 1), id_jadwal: 'b', waktu_mulai: '05:10' },
      { ...baris('2026-10-16', 'Hadir', 1), id_jadwal: 'a', waktu_mulai: '05:10' },
    ];

    expect(urutKronologis(rows).map((r) => r.id_jadwal)).toEqual(['a', 'b']);
    expect(hitungStreakAlpha(rows)).toBe(1);
  });
});

describe('evaluasiSantri — filter periode', () => {
  it('baris di luar periode tidak dihitung untuk rasio, streak, maupun jumlah', () => {
    const rows = [
      // Di luar periode Oktober: Tidak_Hadir lama harus diabaikan.
      baris('2026-09-15', 'Tidak_Hadir', 0),
      baris('2026-09-16', 'Tidak_Hadir', 1),
      baris('2026-09-17', 'Tidak_Hadir', 2),
      // Dalam periode: streak alpha 2 terbaru tetap dihitung.
      baris('2026-10-15', 'Tidak_Hadir', 0),
      baris('2026-10-16', 'Tidak_Hadir', 1),
      baris('2026-10-14', 'Hadir', 2),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.jumlah).toEqual({ hadir: 1, tidak_hadir: 2, izin: 0 });
    expect(hasil.streak_alpha).toBe(2);
    expect(hasil.rasio).toBe(33.3); // 1/3, bukan 1/6
    expect(hasil.kategori).toBe('KRITIS'); // rasio saja
    expect(hasil.alasan).toEqual(['rasio']);
  });
});

describe('evaluasiSantri — alasan & rekomendasi', () => {
  it('rasio dan streak sekaligus -> alasan keduanya + teks kombinasi', () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => baris('2026-10-14', 'Hadir', i)),
      baris('2026-10-15', 'Tidak_Hadir', 0),
      baris('2026-10-15', 'Tidak_Hadir', 1),
      baris('2026-10-16', 'Tidak_Hadir', 2),
    ];

    const hasil = evaluasiSantri(rows, OKTOBER);

    expect(hasil.alasan).toEqual(['rasio', 'streak']);
    expect(hasil.rasio).toBe(50); // 3 hadir / 6 terhitung
    expect(hasil.streak_alpha).toBe(3);
    expect(rekomendasiTindakan(hasil.alasan)).toBe(
      ATURAN_REKOMENDASI.rasio_dan_streak,
    );
  });

  it('rekomendasi mengikuti pemicu: rasio saja / streak saja', () => {
    expect(rekomendasiTindakan(['rasio'])).toBe(ATURAN_REKOMENDASI.rasio);
    expect(rekomendasiTindakan(['streak'])).toBe(ATURAN_REKOMENDASI.streak);
    expect(rekomendasiTindakan([])).toBe('');
  });
});
