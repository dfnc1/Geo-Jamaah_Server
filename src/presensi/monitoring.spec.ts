import {
  formatTanggal,
  STATUS_MONITORING,
  susunMonitoring,
  tanggalWibDariString,
  toStatusMonitoring,
  JadwalMonitoring,
  SantriMonitoring,
  BarisMonitoring,
} from './monitoring';

const JADWAL: JadwalMonitoring[] = [
  {
    id_jadwal: 'jadwal-subuh',
    nama_sholat: 'Subuh',
    waktu_azan: '04:30',
    waktu_mulai_presensi: '04:15',
    waktu_akhir_presensi: '05:10',
  },
  {
    id_jadwal: 'jadwal-dzuhur',
    nama_sholat: 'Dzuhur',
    waktu_azan: '11:45',
    waktu_mulai_presensi: '11:30',
    waktu_akhir_presensi: '12:30',
  },
];

const SANTRI: SantriMonitoring[] = [
  { nim: '24050505050', nama: 'santri_satu', kamar: 'A-12' },
  { nim: '24060505092', nama: 'santri_tiga', kamar: 'B-03' },
];

function baris(nim: string, idJadwal: string, status: string): BarisMonitoring {
  return { nim, id_jadwal: idJadwal, status_presensi: status };
}

describe('monitoring (fungsi murni penyusun matriks)', () => {
  describe('toStatusMonitoring', () => {
    it('empat nilai enum dilewatkan apa adanya', () => {
      expect(toStatusMonitoring('Hadir')).toBe('Hadir');
      expect(toStatusMonitoring('Tidak_Hadir')).toBe('Tidak_Hadir');
      expect(toStatusMonitoring('Izin')).toBe('Izin');
      expect(toStatusMonitoring('Manual')).toBe('Manual');
    });

    it('nilai tak dikenal (defensif) diperlakukan "Belum"', () => {
      expect(toStatusMonitoring('Alfa')).toBe('Belum');
      expect(toStatusMonitoring('')).toBe('Belum');
    });
  });

  it('jadwal tanpa baris presensi berstatus "Belum"', () => {
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: JADWAL,
      santri: [SANTRI[0]],
      presensi: [baris('24050505050', 'jadwal-subuh', 'Hadir')],
    });

    expect(hasil.santri[0].status).toEqual([
      {
        id_jadwal: 'jadwal-subuh',
        nama_sholat: 'Subuh',
        status: 'Hadir',
      },
      {
        id_jadwal: 'jadwal-dzuhur',
        nama_sholat: 'Dzuhur',
        status: 'Belum',
      },
    ]);
  });

  it('ringkasan menghitung sel (santri x jadwal) per status dan totalnya konsisten', () => {
    // 2 santri x 3 jadwal = 6 sel; hanya 4 yang punya baris.
    const jadwalTiga = [
      ...JADWAL,
      {
        id_jadwal: 'jadwal-ashar',
        nama_sholat: 'Ashar',
        waktu_azan: '15:00',
        waktu_mulai_presensi: '14:45',
        waktu_akhir_presensi: '15:45',
      },
    ];
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: jadwalTiga,
      santri: SANTRI,
      presensi: [
        baris('24050505050', 'jadwal-subuh', 'Hadir'),
        baris('24050505050', 'jadwal-dzuhur', 'Manual'),
        baris('24060505092', 'jadwal-subuh', 'Tidak_Hadir'),
        baris('24060505092', 'jadwal-dzuhur', 'Izin'),
      ],
    });

    expect(hasil.ringkasan).toEqual({
      Hadir: 1,
      Tidak_Hadir: 1,
      Izin: 1,
      Manual: 1,
      Belum: 2,
    });
    const total = Object.values(hasil.ringkasan).reduce((a, b) => a + b, 0);
    expect(total).toBe(hasil.santri.length * hasil.jadwal.length);
  });

  it('presensi milik santri/jadwal lain tidak ikut terhitung', () => {
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: JADWAL,
      santri: [SANTRI[0]], // hanya santri_satu
      presensi: [
        baris('24060505092', 'jadwal-subuh', 'Hadir'), // santri lain
        baris('24050505050', 'jadwal-lain', 'Hadir'), // jadwal lain
      ],
    });

    expect(hasil.santri[0].status.every((s) => s.status === 'Belum')).toBe(true);
    expect(hasil.ringkasan.Belum).toBe(2);
    expect(hasil.ringkasan.Hadir).toBe(0);
  });

  it('urutan santri (nim) dan jadwal (azan) dipertahankan dari input', () => {
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: JADWAL,
      santri: SANTRI,
      presensi: [],
    });

    expect(hasil.jadwal.map((j) => j.nama_sholat)).toEqual(['Subuh', 'Dzuhur']);
    expect(hasil.santri.map((s) => s.nim)).toEqual([
      '24050505050',
      '24060505092',
    ]);
    // Baris status mengikuti urutan jadwal yang sama.
    expect(hasil.santri[0].status.map((s) => s.id_jadwal)).toEqual([
      'jadwal-subuh',
      'jadwal-dzuhur',
    ]);
  });

  it('data jadwal di respons tidak membawa kolom presensi bawaan query', () => {
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: JADWAL,
      santri: [],
      presensi: [],
    });

    expect(hasil.santri).toEqual([]);
    expect(hasil.ringkasan).toEqual({
      Hadir: 0,
      Tidak_Hadir: 0,
      Izin: 0,
      Manual: 0,
      Belum: 0,
    });
    expect(hasil.jadwal).toEqual(JADWAL);
  });

  it('pasangan (nim, id_jadwal) ganda tak terduga: baris terakhir menang, ringkasan tetap jumlah sel', () => {
    const hasil = susunMonitoring({
      tanggal: '2026-10-18',
      jadwal: [JADWAL[0]],
      santri: [SANTRI[0]],
      presensi: [
        baris('24050505050', 'jadwal-subuh', 'Tidak_Hadir'),
        baris('24050505050', 'jadwal-subuh', 'Hadir'),
      ],
    });

    expect(hasil.santri[0].status[0].status).toBe('Hadir');
    expect(hasil.ringkasan.Hadir).toBe(1);
    expect(hasil.ringkasan.Tidak_Hadir).toBe(0);
  });

  it('STATUS_MONITORING selalu memuat 4 enum + Belum (kontrak Swagger)', () => {
    expect(STATUS_MONITORING).toEqual([
      'Hadir',
      'Tidak_Hadir',
      'Izin',
      'Manual',
      'Belum',
    ]);
  });
});

describe('tanggalWibDariString & formatTanggal', () => {
  it('"2026-10-18" -> Date tengah malam UTC (bentuk kolom @db.Date)', () => {
    const date = tanggalWibDariString('2026-10-18');
    expect(date.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });

  it('formatTanggal membalikkan kembali ke "YYYY-MM-DD"', () => {
    expect(formatTanggal(tanggalWibDariString('2026-01-05'))).toBe('2026-01-05');
    expect(formatTanggal(tanggalWibDariString('2026-12-31'))).toBe('2026-12-31');
  });

  it('bulan dan tanggal satu digit tetap zero-padded', () => {
    expect(formatTanggal(tanggalWibDariString('2026-03-07'))).toBe('2026-03-07');
  });
});
