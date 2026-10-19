import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { DssService } from '@src/dss/dss.service';
import { toWibDate } from '@src/presensi/wib-time';
import { hitungTrenHarian, TrenHarian } from './dashboard-tren';
import { QueryTrenKehadiranDto } from './dto/query-tren-kehadiran.dto';
import {
  TrenKehadiranResponseDto,
} from './dto/tren-kehadiran.dto';
import { RekapResponseDto } from './dto/rekap.dto';

/** Default periode rekap admin (hari) bila env tidak diatur. */
const REKAP_PERIODE_HARI_DEFAULT = 30;

/**
 * Dashboard dan rekap (tahap 12).
 *
 * Tren kehadiran: satu query agregasi `groupBy` (tanggal + status_presensi),
 * lalu fungsi murni `hitungTrenHarian` susun array per hari (hari kosong tetap
 * muncul bernilai 0). Tidak ada loop per hari ke database.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly dssService: DssService,
    private readonly configService: ConfigService,
  ) {}

  // =========================================================================
  // Tren kehadiran
  // =========================================================================

  /**
   * Tren kehadiran santri binaan Musyrif (hanya binaan aktif).
   * Query agregasi tunggal ke tabel presensi dengan filter nim binaan.
   */
  async trenKehadiranMusyrif(
    idPengguna: string,
    dto: QueryTrenKehadiranDto,
  ): Promise<TrenKehadiranResponseDto> {
    const hari = dto.hari ?? 7;
    const sekarang = new Date();
    const akhir = toWibDate(sekarang);
    const mulai = new Date(
      akhir.getTime() - (hari - 1) * 24 * 60 * 60 * 1000,
    );

    // Query 1: profil Musyrif (untuk daftar binaan).
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

    // Query 2: daftar NIM binaan aktif.
    const santri = await this.prismaService.mahasantri.findMany({
      where: { id_musyrif: musyrif.id_musyrif, status_aktif: true },
      select: { nim: true },
    });

    // Query 3 (agregasi): groupBy tanggal + status_presensi untuk binaan.
    const rows = await this.prismaService.presensi.groupBy({
      by: ['tanggal', 'status_presensi'],
      where: {
        tanggal: { gte: mulai, lte: akhir },
        nim: { in: santri.map((s) => s.nim) },
      },
      _count: true,
    });

    const baris = rows.map((r) => ({
      tanggal: r.tanggal,
      status_presensi: r.status_presensi as string,
    }));
    const tren = hitungTrenHarian(baris, mulai, akhir);

    return this.keTrenResponse(hari, mulai, akhir, tren);
  }

  /**
   * Tren kehadiran semua Mahasantri aktif (Admin).
   * Query agregasi tunggal tanpa filter nim (semua santri aktif).
   */
  async trenKehadiranAdmin(
    dto: QueryTrenKehadiranDto,
  ): Promise<TrenKehadiranResponseDto> {
    const hari = dto.hari ?? 7;
    const sekarang = new Date();
    const akhir = toWibDate(sekarang);
    const mulai = new Date(
      akhir.getTime() - (hari - 1) * 24 * 60 * 60 * 1000,
    );

    // Query 1: daftar NIM semua Mahasantri aktif (untuk cakupan yang benar).
    const santri = await this.prismaService.mahasantri.findMany({
      where: { status_aktif: true },
      select: { nim: true },
    });

    // Query 2 (agregasi): groupBy tanggal + status_presensi untuk semua aktif.
    const rows = await this.prismaService.presensi.groupBy({
      by: ['tanggal', 'status_presensi'],
      where: {
        tanggal: { gte: mulai, lte: akhir },
        nim: { in: santri.map((s) => s.nim) },
      },
      _count: true,
    });

    const baris = rows.map((r) => ({
      tanggal: r.tanggal,
      status_presensi: r.status_presensi as string,
    }));
    const tren = hitungTrenHarian(baris, mulai, akhir);

    return this.keTrenResponse(hari, mulai, akhir, tren);
  }

  private keTrenResponse(
    hari: number,
    mulai: Date,
    akhir: Date,
    tren: TrenHarian[],
  ): TrenKehadiranResponseDto {
    return {
      hari,
      tanggal_mulai: mulai.toISOString().slice(0, 10),
      tanggal_akhir: akhir.toISOString().slice(0, 10),
      data: tren.map((h) => ({
        tanggal: h.tanggal,
        hadir: h.hadir,
        tidak_hadir: h.tidak_hadir,
        izin: h.izin,
        manual: h.manual,
        total: h.total,
        persen_hadir: h.persen_hadir,
      })),
    } as TrenKehadiranResponseDto;
  }

  // =========================================================================
  // Rekap admin
  // =========================================================================

  async rekapAdmin(): Promise<RekapResponseDto> {
    const periodeHari = this.resolvePeriodeHari();
    const sekarang = new Date();
    const akhir = toWibDate(sekarang);
    const mulai = new Date(
      akhir.getTime() - (periodeHari - 1) * 24 * 60 * 60 * 1000,
    );

    // Jumlah Mahasantri aktif.
    const jumlahSantriAktif = await this.prismaService.mahasantri.count({
      where: { status_aktif: true },
    });

    // Jumlah presensi per status dalam periode (groupBy satu query).
    const presensiRows = await this.prismaService.presensi.groupBy({
      by: ['status_presensi'],
      where: {
        tanggal: { gte: mulai, lte: akhir },
      },
      _count: true,
    });

    const presensi = this.hitungStatusPresensi(presensiRows);

    // Jumlah izin per status persetujuan (groupBy satu query).
    const izinRows = await this.prismaService.izin.groupBy({
      by: ['status_persetujuan'],
      _count: true,
    });

    const izin = this.hitungStatusIzin(izinRows);

    // Jumlah santri kritis via fungsi DSS yang sudah ada.
    // Catatan: DSS butuh id_pengguna Musyrif; untuk rekap global kita butuh
    // satu Musyrif representatif. Jika tidak ada Musyrif, jumlah = 0.
    let jumlahSantriKritis = 0;
    const musyrifPertama = await this.prismaService.musyrif.findFirst({
      select: { id_pengguna: true },
    });
    if (musyrifPertama) {
      const kritis = await this.dssService.findSantriKritis(
        musyrifPertama.id_pengguna,
      );
      jumlahSantriKritis = kritis.length;
    }

    return {
      jumlah_santri_aktif: jumlahSantriAktif,
      presensi,
      izin,
      jumlah_santri_kritis: jumlahSantriKritis,
    } as RekapResponseDto;
  }

  private hitungStatusPresensi(
    rows: Array<{ status_presensi: string; _count: number }>,
  ) {
    const hitung = {
      hadir: 0,
      tidak_hadir: 0,
      izin: 0,
      manual: 0,
    };
    for (const r of rows) {
      const n = r._count;
      if (r.status_presensi === 'Hadir') hitung.hadir += n;
      else if (r.status_presensi === 'Manual') hitung.manual += n;
      else if (r.status_presensi === 'Tidak_Hadir') hitung.tidak_hadir += n;
      else if (r.status_presensi === 'Izin') hitung.izin += n;
    }
    return {
      hadir: hitung.hadir,
      tidak_hadir: hitung.tidak_hadir,
      izin: hitung.izin,
      manual: hitung.manual,
      total: hitung.hadir + hitung.tidak_hadir + hitung.izin + hitung.manual,
    };
  }

  private hitungStatusIzin(
    rows: Array<{ status_persetujuan: string; _count: number }>,
  ) {
    const hitung = { pending: 0, disetujui: 0, ditolak: 0 };
    for (const r of rows) {
      const n = r._count;
      if (r.status_persetujuan === 'Pending') hitung.pending += n;
      else if (r.status_persetujuan === 'Disetujui') hitung.disetujui += n;
      else if (r.status_persetujuan === 'Ditolak') hitung.ditolak += n;
    }
    return {
      pending: hitung.pending,
      disetujui: hitung.disetujui,
      ditolak: hitung.ditolak,
      total: hitung.pending + hitung.disetujui + hitung.ditolak,
    };
  }

  /** Periode rekap dari env REKAP_PERIODE_HARI; tidak valid -> default + warn. */
  private resolvePeriodeHari(): number {
    const raw = this.configService.get<string>('REKAP_PERIODE_HARI');
    if (raw !== undefined) {
      const trimmed = raw.trim();
      if (/^\d+$/.test(trimmed)) {
        const value = Number(trimmed);
        if (value > 0) return value;
      }
    }
    if (raw !== undefined && raw.trim() !== '') {
      this.logger.warn(
        `Nilai env REKAP_PERIODE_HARI tidak valid ("${raw}"), memakai default ${REKAP_PERIODE_HARI_DEFAULT}`,
      );
    }
    return REKAP_PERIODE_HARI_DEFAULT;
  }
}
