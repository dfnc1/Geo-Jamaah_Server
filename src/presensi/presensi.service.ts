import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { Prisma, StatusPresensi } from '@generated/prisma/client';
import { CreatePresensiDto } from './dto/create-presensi.dto';
import { PresensiDto } from './dto/presensi.dto';
import { haversineMeter } from './haversine';
import { isWithinWindow, toWibDate, toWibHHmm } from './wib-time';

/** Batas akurasi GPS (meter); di atas nilai ini presensi ditolak (BR-04). */
const MAKS_AKURASI_METER = 50;

@Injectable()
export class PresensiService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Catat presensi Mahasantri.
   *
   * `idPengguna` berasal dari token JWT (klaim `sub`); nim diambil dari
   * profil Mahasantri terkait, bukan dari body request.
   *
   * Urutan validasi (BR-04 → BR-02 → BR-01 → BR-03):
   * 1. mock location, 2. akurasi GPS, 3. data ada (404), 4. window time
   *    jam server WIB, 5. radius geofence Haversine, 6. simpan — dengan
   *    proteksi double presensi dari `@@unique` (P2002 → 409).
   */
  async create(
    idPengguna: string,
    dto: CreatePresensiDto,
  ): Promise<PresensiDto> {
    // 1. Anti-fake GPS: lokasi palsu langsung ditolak (BR-04).
    if (dto.is_mock_location) {
      throw new BadRequestException({
        message: 'Lokasi terdeteksi sebagai mock/Fake GPS, presensi ditolak',
        error: 'ERR_MOCK_LOCATION',
      });
    }

    // 2. Akurasi GPS harus memadai (BR-04). Tepat 50 m masih diterima.
    if (dto.akurasi_meter > MAKS_AKURASI_METER) {
      throw new BadRequestException({
        message: `Akurasi GPS kurang baik (maksimal ${MAKS_AKURASI_METER} meter), coba lagi di tempat terbuka`,
        error: 'ERR_GPS_ACCURACY_LOW',
      });
    }

    // Ambil semua data rujukan sekaligus; urutan pengecekan 404 mengikuti
    // kontrak: jadwal dulu, lalu masjid. Profil Mahasantri bersifat
    // pertahanan (sudah dijamin JwtStrategy saat login/aktivasi token).
    const [santri, jadwal, masjid] = await Promise.all([
      this.prismaService.mahasantri.findUnique({
        where: { id_pengguna: idPengguna },
        select: { nim: true },
      }),
      this.prismaService.jadwalSholat.findUnique({
        where: { id_jadwal: dto.id_jadwal },
      }),
      this.prismaService.masjid.findUnique({
        where: { id_masjid: dto.id_masjid },
      }),
    ]);

    if (!santri) throw this.mahasantriNotFound();
    if (!jadwal) throw this.jadwalNotFound();
    if (!masjid) throw this.masjidNotFound();

    // 3. Window time memakai jam SERVER zona Asia/Jakarta, bukan jam HP (BR-02).
    // Satu momen `sekarang` dipakai untuk window dan tanggal agar konsisten.
    const sekarang = new Date();
    if (
      !isWithinWindow(
        toWibHHmm(sekarang),
        jadwal.waktu_mulai_presensi,
        jadwal.waktu_akhir_presensi,
      )
    ) {
      throw new BadRequestException({
        message: `Sekarang di luar waktu presensi (dibenarkan ${jadwal.waktu_mulai_presensi} - ${jadwal.waktu_akhir_presensi} WIB)`,
        error: 'ERR_TIME_WINDOW_INVALID',
      });
    }

    // 4. Radius geofence: jarak Haversine user ↔ masjid harus <= radius (BR-01).
    const jarakMeter = haversineMeter(
      dto.latitude_user,
      dto.longitude_user,
      masjid.latitude,
      masjid.longitude,
    );

    if (jarakMeter > masjid.radius_toleransi) {
      throw new BadRequestException({
        message: `Anda berada ${Math.round(jarakMeter)} meter dari masjid (radius ${Math.round(masjid.radius_toleransi)} meter)`,
        error: 'ERR_GEOFENCE_RADIUS_EXCEEDED',
      });
    }

    // 5. Simpan. Double presensi dijaga unique constraint
    //    @@unique([nim, id_jadwal, tanggal]); P2002 ditangkap langsung
    //    supaya aman terhadap race condition dua request bersamaan (BR-03).
    try {
      await this.prismaService.presensi.create({
        data: {
          nim: santri.nim,
          id_jadwal: jadwal.id_jadwal,
          id_masjid: masjid.id_masjid,
          tanggal: toWibDate(sekarang),
          latitude_user: dto.latitude_user,
          longitude_user: dto.longitude_user,
          akurasi_meter: dto.akurasi_meter,
          is_mock_location: dto.is_mock_location,
          status_presensi: StatusPresensi.Hadir,
        },
      });
    } catch (e) {
      // P2002 di tabel presensi hanya bisa berasal dari @@unique
      // [nim, id_jadwal, tanggal] karena hanya kolom itulah yang unik.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Anda sudah melakukan presensi untuk jadwal ini hari ini',
          error: 'ERR_ALREADY_PRESENT',
        });
      }
      throw e;
    }

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Presensi', <fungsi teks>) pada controller.

    return {
      status_presensi: StatusPresensi.Hadir,
      nama_sholat: jadwal.nama_sholat,
      // Dibulatkan 2 desimal hanya untuk response; nilai tidak disimpan
      // (model Presensi tidak punya kolom jarak).
      jarak_meter: Math.round(jarakMeter * 100) / 100,
    };
  }

  private mahasantriNotFound(): NotFoundException {
    return new NotFoundException({
      message: 'Data mahasantri tidak ditemukan',
      error: 'ERR_MAHASANTRI_NOT_FOUND',
    });
  }

  private jadwalNotFound(): NotFoundException {
    return new NotFoundException({
      message: 'Jadwal sholat tidak ditemukan',
      error: 'ERR_JADWAL_NOT_FOUND',
    });
  }

  private masjidNotFound(): NotFoundException {
    return new NotFoundException({
      message: 'Masjid tidak ditemukan',
      error: 'ERR_MASJID_NOT_FOUND',
    });
  }
}
