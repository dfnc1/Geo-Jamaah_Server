import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { toWibDate, toWibHHmm } from './wib-time';
import { formatTanggal } from './monitoring';
import { susunHariIni } from './hari-ini';
import { HariIniResponseDto } from './dto/hari-ini.dto';

/**
 * Ringkasan presensi hari ini untuk Mahasantri (tahap 6).
 *
 * Strategi query — tepat **3 query** tanpa N+1:
 *   Q1. Ambil nim dari profil Mahasantri (token sub → id_pengguna).
 *   Q2. Ambil masjid utama (nama lalu id menaik) — aturan sama dengan job.
 *   Q3. Ambil semua jadwal (urut waktu_azan) dengan nested baris presensi
 *       milik santri itu pada tanggal WIB hari ini.
 *
 * Q2 dan Q3 dijalankan sejajar lewat `Promise.all` setelah Q1 selesai.
 */
@Injectable()
export class HariIniService {
  constructor(private readonly prismaService: PrismaService) {}

  async ringkasan(idPengguna: string): Promise<HariIniResponseDto> {
    // Q1: resolve nim dari token (sub = id_pengguna).
    const santri = await this.prismaService.mahasantri.findUnique({
      where: { id_pengguna: idPengguna },
      select: { nim: true },
    });
    if (!santri) {
      throw new NotFoundException({
        message: 'Data mahasantri tidak ditemukan',
        error: 'ERR_MAHASANTRI_NOT_FOUND',
      });
    }

    const sekarang = new Date();
    const hariIni = toWibDate(sekarang);
    const nowHHmm = toWibHHmm(sekarang);

    // Q2 dan Q3 sejajar.
    const [masjid, jadwalRaw] = await Promise.all([
      // Q2: masjid utama — deterministik, aturan sama dengan job tahap 8.
      this.prismaService.masjid.findFirst({
        orderBy: [{ nama_masjid: 'asc' }, { id_masjid: 'asc' }],
        select: {
          id_masjid: true,
          nama_masjid: true,
          latitude: true,
          longitude: true,
          radius_toleransi: true,
        },
      }),
      // Q3: semua jadwal + baris presensi santri hari ini, satu panggilan.
      this.prismaService.jadwalSholat.findMany({
        select: {
          id_jadwal: true,
          nama_sholat: true,
          waktu_azan: true,
          waktu_iqamah: true,
          waktu_mulai_presensi: true,
          waktu_akhir_presensi: true,
          presensi: {
            where: { nim: santri.nim, tanggal: hariIni },
            select: { id_jadwal: true, status_presensi: true },
          },
        },
        orderBy: { waktu_azan: 'asc' },
      }),
    ]);

    // Flatten baris presensi dari nested array masing-masing jadwal.
    const baris = jadwalRaw.flatMap((j) =>
      j.presensi.map((p) => ({
        id_jadwal: p.id_jadwal,
        status_presensi: p.status_presensi as string,
      })),
    );

    const jadwal = susunHariIni(
      jadwalRaw.map((j) => ({
        id_jadwal: j.id_jadwal,
        nama_sholat: j.nama_sholat,
        waktu_azan: j.waktu_azan,
        waktu_iqamah: j.waktu_iqamah,
        waktu_mulai_presensi: j.waktu_mulai_presensi,
        waktu_akhir_presensi: j.waktu_akhir_presensi,
      })),
      baris,
      nowHHmm,
    );

    return {
      tanggal: formatTanggal(hariIni),
      masjid: masjid ?? null,
      jadwal,
    };
  }
}
