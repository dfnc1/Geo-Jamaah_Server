import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { toWibDate } from './wib-time';
import {
  formatTanggal,
  susunMonitoring,
  tanggalWibDariString,
} from './monitoring';
import { QueryMonitoringDto } from './dto/query-monitoring.dto';
import { MonitoringResponseDto } from './dto/monitoring.dto';

/**
 * Monitoring presensi harian untuk Musyrif (tahap 9).
 *
 * Strategi query: tepat **3 query** — profil Musyrif -> daftar santri
 * binaan aktif -> jadwal sholat lengkap dengan baris presensi binaan pada
 * tanggal itu (nested `include`, satu panggilan). Tidak ada query per santri
 * (N+1). Jadwal diambil lewat model `jadwalSholat` (bukan lewat baris
 * presensi) supaya jadwal yang belum punya baris pun tetap muncul sebagai
 * kolom "Belum".
 */
@Injectable()
export class MusyrifPresensiService {
  constructor(private readonly prismaService: PrismaService) {}

  async monitoring(
    idPengguna: string,
    dto: QueryMonitoringDto,
  ): Promise<MonitoringResponseDto> {
    const hariIni = toWibDate(new Date());
    const tanggal = dto.tanggal ? tanggalWibDariString(dto.tanggal) : hariIni;
    if (tanggal.getTime() > hariIni.getTime()) {
      throw new BadRequestException({
        message: 'tanggal tidak boleh melebihi hari ini',
        error: 'ERR_VALIDATION',
      });
    }

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

    // Query 2: hanya santri BINAAN dan masih AKTIF (isolasinya di where).
    const santri = await this.prismaService.mahasantri.findMany({
      where: { id_musyrif: musyrif.id_musyrif, status_aktif: true },
      select: { nim: true, nama: true, kamar: true },
      orderBy: { nim: 'asc' },
    });

    // Query 3: semua jadwal (urut azan menaik) + baris presensi binaan pada
    // tanggal itu, diambil nested dalam satu panggilan. `in: []` (tanpa
    // binaan) menghasilkan presensi kosong — bentuk respons tetap utuh.
    const jadwal = await this.prismaService.jadwalSholat.findMany({
      select: {
        id_jadwal: true,
        nama_sholat: true,
        waktu_azan: true,
        waktu_mulai_presensi: true,
        waktu_akhir_presensi: true,
        presensi: {
          where: {
            tanggal,
            nim: { in: santri.map((s) => s.nim) },
          },
          select: { nim: true, id_jadwal: true, status_presensi: true },
        },
      },
      orderBy: { waktu_azan: 'asc' },
    });

    const presensi = jadwal.flatMap((j) => j.presensi);
    return susunMonitoring({
      tanggal: formatTanggal(tanggal),
      // Kolom presensi (nested) tidak ikut ke respons — hanya kolom jadwal.
      jadwal: jadwal.map((j) => ({
        id_jadwal: j.id_jadwal,
        nama_sholat: j.nama_sholat,
        waktu_azan: j.waktu_azan,
        waktu_mulai_presensi: j.waktu_mulai_presensi,
        waktu_akhir_presensi: j.waktu_akhir_presensi,
      })),
      santri,
      presensi,
    });
  }
}
