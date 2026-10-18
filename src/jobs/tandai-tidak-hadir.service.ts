import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@src/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';
import { StatusPresensi, StatusPersetujuan } from '@generated/prisma/enums';
import { toWibDate, toWibHHmm } from '@src/presensi/wib-time';
import { tentukanAbsensi, StatusAbsenOtomatis } from './keputusan-absen';
import { RunTandaiTidakHadirDto } from './dto/run-tandai-tidak-hadir.dto';
import { HasilTandaiTidakHadirDto } from './dto/hasil-tandai.dto';

type BarisAbsen = {
  nim: string;
  id_jadwal: string;
  id_masjid: string;
  tanggal: Date;
  latitude_user: number;
  longitude_user: number;
  is_mock_location: boolean;
  is_manual: boolean;
  status_presensi: StatusAbsenOtomatis;
};

/**
 * Job penandaan presensi otomatis (BR-05).
 *
 * Cron tiap menit (zona Asia/Jakarta) memproses jadwal yang
 * `waktu_akhir_presensi`-nya sudah lewat untuk tanggal WIB hari ini.
 * Idempoten: kandidat hanya yang belum punya baris presensi dan tulis
 * memakai `createMany(skipDuplicates)` yang memanfaatkan
 * `@@unique([nim, id_jadwal, tanggal])` — baris Hadir yang sudah ada tidak
 * pernah tertimpa.
 *
 * Pilihan desain (tahap 8, disetujui): presensi otomatis tidak punya
 * lokasi asli, jadi baris dibuat dengan `id_masjid` "masjid utama"
 * (deterministik: nama lalu id menaik) dan koordinat 0,0 yang jelas palsu.
 * Baris otomatis dikenali dari `status_presensi` (`Tidak_Hadir`/`Izin`).
 */
@Injectable()
export class TandaiTidakHadirService {
  private readonly logger = new Logger(TandaiTidakHadirService.name);
  /**
   * Kunci "id_jadwal|YYYY-MM-DD" yang sudah sukses diproses cron. In-memory
   * saja: restart menghapusnya, tetapi aman karena job idempoten. Kunci tidak
   * ditambahkan saat gagal supaya cron mencoba lagi menit berikutnya.
   */
  private readonly sudahDiproses = new Set<string>();

  constructor(private readonly prismaService: PrismaService) {}

  @Cron('* * * * *', { name: 'tandai-tidak-hadir', timeZone: 'Asia/Jakarta' })
  async handleCron(): Promise<void> {
    try {
      const sekarang = new Date();
      const jamWib = toWibHHmm(sekarang);
      const hariIni = toWibDate(sekarang);
      const tanggalKunci = this.toTanggalKunci(hariIni);

      const jadwal = await this.prismaService.jadwalSholat.findMany({
        // Perbandingan "HH:mm" = leksikografis = kronologis (format divalidasi
        // ketat nol-terisi24 jam).
        where: { waktu_akhir_presensi: { lte: jamWib } },
      });

      for (const j of jadwal) {
        const kunci = `${j.id_jadwal}|${tanggalKunci}`;
        if (this.sudahDiproses.has(kunci)) continue;
        try {
          const hasil = await this.tandaiSatuJadwal(j.id_jadwal, hariIni);
          this.sudahDiproses.add(kunci);
          this.logger.log(
            `Tandai ${j.nama_sholat} ${tanggalKunci}: ` +
              `Tidak_Hadir ${hasil.Tidak_Hadir}, Izin ${hasil.Izin}`,
          );
        } catch (err) {
          // Satu jadwal gagal tidak menghentikan jadwal lain, dan karena
          // kuncinya tidak dicatat, jadwal ini dicoba lagi menit berikutnya.
          this.logger.error(
            `Gagal menandai jadwal ${j.nama_sholat} (${j.id_jadwal}) tanggal ${tanggalKunci}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Cron tandai-tidak-hadir gagal total',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Pemicu manual untuk demo/Admin (tetap aturan BR-05 yang sama).
   * Body opsional: `tanggal` (default hari ini WIB) dan `id_jadwal`
   * (default semua jadwal yang window-nya sudah lewat).
   */
  async jalankan(
    dto: RunTandaiTidakHadirDto,
  ): Promise<HasilTandaiTidakHadirDto> {
    const sekarang = new Date();
    const hariIni = toWibDate(sekarang);
    const jamWib = toWibHHmm(sekarang);

    const tanggal = dto.tanggal ? this.parseTanggal(dto.tanggal) : hariIni;
    if (tanggal.getTime() > hariIni.getTime()) {
      throw new BadRequestException({
        message: 'tanggal tidak boleh melebihi hari ini',
        error: 'ERR_VALIDATION',
      });
    }
    const tanggalKunci = this.toTanggalKunci(tanggal);
    const tanggalLampau = tanggal.getTime() < hariIni.getTime();

    let jadwalTerpilih: Array<{
      id_jadwal: string;
      nama_sholat: string;
      waktu_akhir_presensi: string;
    }>;

    if (dto.id_jadwal) {
      const jadwal = await this.prismaService.jadwalSholat.findUnique({
        where: { id_jadwal: dto.id_jadwal },
      });
      if (!jadwal) {
        throw new NotFoundException({
          message: 'Jadwal sholat tidak ditemukan',
          error: 'ERR_JADWAL_NOT_FOUND',
        });
      }
      // Tanggal hari ini: window harus sudah lewat, jangan pernah menandai
      // santri yang masih bisa presensi. Tanggal lampau dianggap sudah lewat.
      if (!tanggalLampau && jadwal.waktu_akhir_presensi > jamWib) {
        throw new BadRequestException({
          message: `Jadwal ${jadwal.nama_sholat} belum melewati waktu akhir presensi (${jadwal.waktu_akhir_presensi} WIB)`,
          error: 'ERR_TIME_WINDOW_INVALID',
        });
      }
      jadwalTerpilih = [jadwal];
    } else if (tanggalLampau) {
      // Tanggal lampau: hari sudah berlalu sepenuhnya, semua jadwal diproses.
      jadwalTerpilih = await this.prismaService.jadwalSholat.findMany();
    } else {
      jadwalTerpilih = await this.prismaService.jadwalSholat.findMany({
        where: { waktu_akhir_presensi: { lte: jamWib } },
      });
    }

    const dibuat = { Tidak_Hadir: 0, Izin: 0 };
    let gagal = 0;
    let errorPertama: unknown;

    for (const j of jadwalTerpilih) {
      try {
        const hasil = await this.tandaiSatuJadwal(j.id_jadwal, tanggal);
        dibuat.Tidak_Hadir += hasil.Tidak_Hadir;
        dibuat.Izin += hasil.Izin;
        this.sudahDiproses.add(`${j.id_jadwal}|${tanggalKunci}`);
      } catch (err) {
        gagal += 1;
        errorPertama = errorPertama ?? err;
        this.logger.error(
          `Pemicu manual: gagal menandai jadwal ${j.nama_sholat} (${j.id_jadwal}) tanggal ${tanggalKunci}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    // Semua jadwal yang diminta gagal (mis. DB bermasalah): jangan berpura-
    // pura sukses dengan nol — lempar error pertama supaya terlihat di respons.
    if (jadwalTerpilih.length > 0 && gagal === jadwalTerpilih.length) {
      throw errorPertama;
    }

    return {
      tanggal: tanggalKunci,
      id_jadwal: dto.id_jadwal ?? null,
      dibuat,
      total_dibuat: dibuat.Tidak_Hadir + dibuat.Izin,
    };
  }

  /**
   * Proses satu jadwal pada satu tanggal: kandidat = Mahasantri aktif tanpa
   * baris presensi; status per kandidat ditentukan `tentukanAbsensi`.
   */
  private async tandaiSatuJadwal(
    idJadwal: string,
    tanggal: Date,
  ): Promise<{ Tidak_Hadir: number; Izin: number }> {
    // Masjid utama sebagai pemilik baris otomatis (tidak ada relasi jadwal →
    // masjid); orderBy deterministik agar hasilnya sama di setiap run.
    const masjid = await this.prismaService.masjid.findFirst({
      orderBy: [{ nama_masjid: 'asc' }, { id_masjid: 'asc' }],
    });
    if (!masjid) {
      throw new Error(
        'Tidak ada data masjid — presensi otomatis membutuhkan masjid utama',
      );
    }

    const [santri, presensiAda, izinDisetujui] = await Promise.all([
      this.prismaService.mahasantri.findMany({
        select: { nim: true, status_aktif: true },
      }),
      this.prismaService.presensi.findMany({
        where: { id_jadwal: idJadwal, tanggal },
        select: { nim: true },
      }),
      this.prismaService.izin.findMany({
        where: {
          status_persetujuan: StatusPersetujuan.Disetujui,
          tanggal_izin: tanggal,
        },
        select: { nim: true },
      }),
    ]);

    const sudah = new Set(presensiAda.map((p) => p.nim));
    const izinSet = new Set(izinDisetujui.map((i) => i.nim));

    const baris: BarisAbsen[] = [];
    for (const s of santri) {
      const keputusan = tentukanAbsensi({
        status_aktif: s.status_aktif,
        punya_presensi: sudah.has(s.nim),
        ada_izin_disetujui: izinSet.has(s.nim),
      });
      if (keputusan.aksi === 'lewati') continue;
      baris.push({
        nim: s.nim,
        id_jadwal: idJadwal,
        id_masjid: masjid.id_masjid,
        tanggal,
        // Opsi A: 0,0 menandakan "bukan lokasi asli" (baris otomatis).
        latitude_user: 0,
        longitude_user: 0,
        is_mock_location: false,
        is_manual: false,
        status_presensi: keputusan.status,
      });
    }

    const hasil = { Tidak_Hadir: 0, Izin: 0 };
    if (baris.length === 0) return hasil;

    try {
      // Dibuat per status supaya jumlah per status diketahui persis.
      // `skipDuplicates` memanfaatkan @@unique([nim, id_jadwal, tanggal]):
      // baris yang sudah ada tidak tertimpa dan tidak terduplikat.
      for (const status of [
        StatusPresensi.Tidak_Hadir,
        StatusPresensi.Izin,
      ]) {
        const sebagian = baris.filter((b) => b.status_presensi === status);
        if (sebagian.length === 0) continue;
        const { count } = await this.prismaService.presensi.createMany({
          data: sebagian,
          skipDuplicates: true,
        });
        hasil[status] = count;
      }
    } catch (err) {
      // Fallback per baris: satu data gagal tidak mematikan sisanya.
      this.logger.error(
        `createMany gagal untuk jadwal ${idJadwal}, mencoba per baris`,
        err instanceof Error ? err.stack : String(err),
      );
      hasil.Tidak_Hadir = 0;
      hasil.Izin = 0;
      for (const b of baris) {
        try {
          await this.prismaService.presensi.create({ data: b });
          hasil[b.status_presensi] += 1;
        } catch (e) {
          // P2002 = baris tercipta oleh proses lain (race) → bukan kegagalan.
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            continue;
          }
          this.logger.error(
            `Gagal membuat presensi otomatis ${b.nim} jadwal ${idJadwal}`,
            e instanceof Error ? e.stack : String(e),
          );
        }
      }
    }

    return hasil;
  }

  private parseTanggal(tanggal: string): Date {
    const [year, month, day] = tanggal.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toTanggalKunci(tanggal: Date): string {
    return tanggal.toISOString().slice(0, 10);
  }
}
