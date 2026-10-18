/**
 * Logika murni monitoring presensi harian Musyrif (tahap 9).
 *
 * Dipisah dari service supaya penyusunan matriks (status per santri per
 * jadwal) dan ringkasan jumlah per status bisa diuji tanpa IO. Tidak ada
 * query di sini — service hanya menyiapkan tiga hasil query lalu memanggil
 * `susunMonitoring`.
 */

/** Status sel monitoring: 4 nilai enum `StatusPresensi` + "Belum" (tanpa baris). */
export const STATUS_MONITORING = [
  'Hadir',
  'Tidak_Hadir',
  'Izin',
  'Manual',
  'Belum',
] as const;

export type StatusMonitoring = (typeof STATUS_MONITORING)[number];

/** Nilai enum `StatusPresensi` yang selalu punya baris presensi. */
const STATUS_DENGAN_BARIS: readonly string[] = [
  'Hadir',
  'Tidak_Hadir',
  'Izin',
  'Manual',
];

/**
 * Petakan status baris presensi ke status monitoring. Nilai enum hanya
 * mungkin empat, jadi pemetaan identitas; nilai tak dikenal (defensif,
 * seharusnya mustahil dari DB) diperlakukan "Belum" supaya ringkasan tetap
 * konsisten dengan jumlah sel.
 */
export function toStatusMonitoring(status: string): StatusMonitoring {
  return STATUS_DENGAN_BARIS.includes(status)
    ? (status as StatusMonitoring)
    : 'Belum';
}

/** Bentuk data jadwal yang dibutuhkan monitoring (urutan bebas, dipertahankan). */
export type JadwalMonitoring = {
  id_jadwal: string;
  nama_sholat: string;
  waktu_azan: string;
  waktu_mulai_presensi: string;
  waktu_akhir_presensi: string;
};

export type SantriMonitoring = {
  nim: string;
  nama: string;
  kamar: string;
};

/** Satu baris presensi hasil query (hanya kolom yang dipakai). */
export type BarisMonitoring = {
  nim: string;
  id_jadwal: string;
  status_presensi: string;
};

/** Jumlah sel (santri × jadwal) per status pada tanggal itu. */
export type RingkasanMonitoring = Record<StatusMonitoring, number>;

export type HasilMonitoring = {
  tanggal: string;
  jadwal: JadwalMonitoring[];
  ringkasan: RingkasanMonitoring;
  santri: Array<
    SantriMonitoring & {
      status: Array<{
        id_jadwal: string;
        nama_sholat: string;
        status: StatusMonitoring;
      }>;
    }
  >;
};

/**
 * Susun matriks monitoring dari tiga hasil query.
 *
 * - `santri` dan `jadwal` dipertahankan urutannya (service mengurutkan
 *   `nim` menaik dan `waktu_azan` menaik).
 * - Sel tanpa baris presensi berstatus `"Belum"` — termasuk jadwal yang
 *   window-nya belum lewat dan jadwal yang memang belum diapa-apakan.
 * - `ringkasan` menghitung **sel** (bukan santri): totalnya selalu
 *   `jumlah_santri × jumlah_jadwal`.
 * - Kunci pasangan `(nim, id_jadwal)` unik karena `@@unique([nim,
 *   id_jadwal, tanggal])`; bila data duplikat tak terduga datang, baris
 *   terakhir yang menang (tidak merusak ringkasan).
 */
export function susunMonitoring(arg: {
  tanggal: string;
  jadwal: JadwalMonitoring[];
  santri: SantriMonitoring[];
  presensi: BarisMonitoring[];
}): HasilMonitoring {
  const statusPerPasangan = new Map<string, StatusMonitoring>();
  for (const baris of arg.presensi) {
    statusPerPasangan.set(
      `${baris.nim}|${baris.id_jadwal}`,
      toStatusMonitoring(baris.status_presensi),
    );
  }

  const ringkasan: RingkasanMonitoring = {
    Hadir: 0,
    Tidak_Hadir: 0,
    Izin: 0,
    Manual: 0,
    Belum: 0,
  };

  const santri = arg.santri.map((s) => ({
    ...s,
    status: arg.jadwal.map((j) => {
      const status = statusPerPasangan.get(`${s.nim}|${j.id_jadwal}`) ?? 'Belum';
      ringkasan[status] += 1;
      return {
        id_jadwal: j.id_jadwal,
        nama_sholat: j.nama_sholat,
        status,
      };
    }),
  }));

  return { tanggal: arg.tanggal, jadwal: arg.jadwal, ringkasan, santri };
}

/**
 * Ubah string "YYYY-MM-DD" (sudah divalidasi DTO) menjadi `Date` pada
 * tengah malam UTC — bentuk yang cocok untuk kolom Prisma `DateTime @db.Date`
 * seperti `toWibDate`. Asumsi format valid.
 */
export function tanggalWibDariString(raw: string): Date {
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Format `Date` (tengah malam UTC) menjadi "YYYY-MM-DD" untuk respons. */
export function formatTanggal(date: Date): string {
  return date.toISOString().slice(0, 10);
}
