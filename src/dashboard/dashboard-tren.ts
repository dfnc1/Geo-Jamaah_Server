import { toWibDate } from '@src/presensi/wib-time';

/** Hasil perhitungan tren kehadiran untuk satu hari. */
export interface TrenHarian {
  tanggal: string; // YYYY-MM-DD (WIB)
  hadir: number;
  tidak_hadir: number;
  izin: number;
  manual: number;
  total: number;
  /** persen_hadir = hadir / (hadir + tidak_hadir) * 100, satu desimal; null bila penyebut 0. */
  persen_hadir: number | null;
}

/** Satu baris presensi hasil query untuk tren kehadiran. */
export interface BarisTren {
  tanggal: Date;
  status_presensi: string;
}

/** Bentuk tanggal WIB ke "YYYY-MM-DD". */
function formatTanggalWib(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Hitung tren kehadiran per hari dalam rentang [mulai, akhir] (inklusif, WIB).
 *
 * Kebijakan:
 * - Hari tanpa data tetap muncul bernilai 0 (tidak di-skip).
 * - persen_hadir = hadir / (hadir + tidak_hadir) * 100, satu desimal.
 * - Izin tidak dihitung tidak hadir dan dikeluarkan dari penyebut.
 * - Manual dihitung hadir.
 * - null jika penyebut nol.
 *
 * Fungsi murni (bebas Prisma/Nest) supaya mudah diuji.
 */
export function hitungTrenHarian(
  baris: BarisTren[],
  tanggalMulai: Date,
  tanggalAkhir: Date,
): TrenHarian[] {
  // Hitung per tanggal (key = "YYYY-MM-DD" WIB).
  const perTanggal = new Map<
    string,
    { hadir: number; tidak_hadir: number; izin: number; manual: number }
  >();

  for (const b of baris) {
    const key = formatTanggalWib(b.tanggal);
    let data = perTanggal.get(key);
    if (!data) {
      data = { hadir: 0, tidak_hadir: 0, izin: 0, manual: 0 };
      perTanggal.set(key, data);
    }
    if (b.status_presensi === 'Hadir' || b.status_presensi === 'Manual') {
      // Manual dihitung hadir (BR-12): masuk ke field hadir untuk persen_hadir,
      // dan juga dicatat terpisah di field manual untuk transparansi tampilan.
      data.hadir += 1;
      if (b.status_presensi === 'Manual') data.manual += 1;
    } else if (b.status_presensi === 'Tidak_Hadir') {
      data.tidak_hadir += 1;
    } else if (b.status_presensi === 'Izin') {
      data.izin += 1;
    }
  }

  // Buat rentang tanggal WIB inkusif; hari tanpa data tetap muncul bernilai 0.
  const mulai = toWibDate(tanggalMulai);
  const akhir = toWibDate(tanggalAkhir);
  const satuHari = 24 * 60 * 60 * 1000;

  const hasil: TrenHarian[] = [];
  for (let t = mulai.getTime(); t <= akhir.getTime(); t += satuHari) {
    const d = new Date(t);
    const key = formatTanggalWib(d);
    const data = perTanggal.get(key) ?? {
      hadir: 0,
      tidak_hadir: 0,
      izin: 0,
      manual: 0,
    };
    const pembilang = data.hadir; // hadir sudah mencakup Manual
    const penyebut = pembilang + data.tidak_hadir;
    const persen_hadir =
      penyebut > 0 ? Math.round((pembilang / penyebut) * 1000) / 10 : null;

    hasil.push({
      tanggal: key,
      hadir: data.hadir,
      tidak_hadir: data.tidak_hadir,
      izin: data.izin,
      manual: data.manual,
      // total tidak menambahkan manual lagi karena manual sudah ikut terhitung
      // dalam hadir (Manual dihitung hadir).
      total: data.hadir + data.tidak_hadir + data.izin,
      persen_hadir,
    });
  }

  return hasil;
}
