import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { SantriKritisDto } from './dto/santri-kritis.dto';
import {
  BarisPresensi,
  evaluasiSantri,
  parsePeriodeHari,
  PERIODE_HARI_DEFAULT,
  rentangPeriode,
  rekomendasiTindakan,
} from './ews';

/**
 * Decision Support System / Early Warning System (BR-08).
 *
 * Strategi query: 3 query tetap (profil musyrif -> daftar santri binaan
 * aktif -> baris presensi dalam periode untuk semua santri sekaligus),
 * lalu rasio/streak dihitung di memori — tanpa query per santri (N+1).
 * Baris otomatis job (koordinat 0,0, masjid utama) dipakai apa adanya:
 * yang dibaca hanya `status_presensi`, `tanggal`, dan waktu mulai jadwal.
 */
@Injectable()
export class DssService {
  private readonly logger = new Logger(DssService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** Daftar Mahasantri binaan aktif yang berkategori KRITIS. */
  async findSantriKritis(idPengguna: string): Promise<SantriKritisDto[]> {
    // Query 1: profil Musyrif dari token (sub -> id_pengguna).
    const musyrif = await this.prismaService.musyrif.findUnique({
      where: { id_pengguna: idPengguna },
      select: { id_musyrif: true },
    });
    if (!musyrif) {
      throw new NotFoundException({
        message: 'Profil musyrif tidak ditemukan',
        error: 'ERR_MUSYRIF_NOT_FOUND',
      });
    }

    // Query 2: hanya santri BINAAN dan masih AKTIF (BR-08).
    const santri = await this.prismaService.mahasantri.findMany({
      where: { id_musyrif: musyrif.id_musyrif, status_aktif: true },
      select: { nim: true, nama: true },
      orderBy: { nim: 'asc' },
    });
    if (santri.length === 0) return [];

    const periodeHari = this.resolvePeriodeHari();
    const rentang = rentangPeriode(periodeHari, new Date());

    // Query 3: baris presensi semua santri binaan dalam satu query.
    // Hanya kolom yang dibutuhkan EWS; perhitungan di memori.
    const rows = await this.prismaService.presensi.findMany({
      where: {
        nim: { in: santri.map((s) => s.nim) },
        tanggal: { gte: rentang.mulai, lte: rentang.akhir },
      },
      select: {
        nim: true,
        tanggal: true,
        status_presensi: true,
        id_jadwal: true,
        jadwal: { select: { waktu_mulai_presensi: true } },
      },
    });

    const perNim = new Map<string, BarisPresensi[]>();
    for (const row of rows) {
      const baris: BarisPresensi = {
        nim: row.nim,
        tanggal: row.tanggal,
        status_presensi: row.status_presensi as unknown as string,
        id_jadwal: row.id_jadwal,
        waktu_mulai: row.jadwal.waktu_mulai_presensi,
      };
      const existing = perNim.get(row.nim);
      if (existing) existing.push(baris);
      else perNim.set(row.nim, [baris]);
    }

    const hasil: SantriKritisDto[] = [];
    for (const s of santri) {
      const evaluasi = evaluasiSantri(perNim.get(s.nim) ?? [], rentang);
      // Invarian: KRITIS selalu punya rasio (streak >= 3 berarti ada baris
      // Tidak_Hadir yang ikut penyebut). Kondisi defensif tetap dijaga.
      if (evaluasi.kategori !== 'KRITIS' || evaluasi.rasio === null) continue;
      hasil.push({
        nim: s.nim,
        nama: s.nama,
        kategori_risiko: 'KRITIS',
        rasio_kehadiran: evaluasi.rasio,
        streak_alpha: evaluasi.streak_alpha,
        jumlah: evaluasi.jumlah,
        alasan: evaluasi.alasan,
        rekomendasi_tindakan: rekomendasiTindakan(evaluasi.alasan),
      });
    }

    // Urutan respons: rasio menaik -> streak menurun -> nim menaik.
    hasil.sort(
      (a, b) =>
        a.rasio_kehadiran - b.rasio_kehadiran ||
        b.streak_alpha - a.streak_alpha ||
        a.nim.localeCompare(b.nim),
    );
    return hasil;
  }

  /** Periode dari env DSS_PERIODE_HARI; tidak valid -> default + warn. */
  private resolvePeriodeHari(): number {
    const raw = this.configService.get<string>('DSS_PERIODE_HARI');
    const periode = parsePeriodeHari(raw);
    if (raw !== undefined && raw.trim() !== '' && periode === PERIODE_HARI_DEFAULT && Number(raw.trim()) !== PERIODE_HARI_DEFAULT) {
      this.logger.warn(
        `Nilai env DSS_PERIODE_HARI tidak valid ("${raw}"), memakai default ${PERIODE_HARI_DEFAULT}`,
      );
    }
    return periode;
  }
}
