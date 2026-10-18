import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { StatusPersetujuan } from '@generated/prisma/client';
import { CreateIzinDto } from './dto/create-izin.dto';
import { QueryMusyrifIzinDto } from './dto/query-musyrif-izin.dto';
import { VerifyIzinDto } from './dto/verify-izin.dto';
import { IzinDto, IzinMusyrifDto } from './dto/izin.dto';
import { canTransition } from './izin-state';

type IzinRow = {
  id_izin: string;
  nim: string;
  id_musyrif: string;
  jenis_izin: string;
  tanggal_izin: Date;
  alasan: string;
  bukti_lampiran: string | null;
  status_persetujuan: string;
};

@Injectable()
export class IzinService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Mahasantri mengajukan izin (BR-06).
   * `idPengguna` dari token (sub); `id_musyrif` diisi otomatis dari Musyrif
   * pembina profil Mahasantri, status selalu Pending.
   */
  async create(idPengguna: string, dto: CreateIzinDto): Promise<IzinDto> {
    const santri = await this.prismaService.mahasantri.findUnique({
      where: { id_pengguna: idPengguna },
      select: { nim: true, id_musyrif: true },
    });
    if (!santri) throw this.mahasantriNotFound();

    const izin = await this.prismaService.izin.create({
      data: {
        nim: santri.nim,
        id_musyrif: santri.id_musyrif,
        jenis_izin: dto.jenis_izin,
        // "YYYY-MM-DD" -> Date tengah-malam UTC (tanggal WIB), konvensi
        // yang sama dengan kolom tanggal pada Presensi.
        tanggal_izin: this.toUtcMidnight(dto.tanggal_izin),
        alasan: dto.alasan,
        bukti_lampiran: dto.bukti_lampiran ?? null,
        status_persetujuan: StatusPersetujuan.Pending,
      },
    });

    // TODO(tahap-11): catat aktivitas "Mengajukan izin <jenis> tanggal <tanggal>" ke activity_logs.
    return this.toIzinDto(izin);
  }

  /** Daftar izin milik sendiri, terbaru dulu (tanggal_izin desc). */
  async findSaya(idPengguna: string): Promise<IzinDto[]> {
    const santri = await this.prismaService.mahasantri.findUnique({
      where: { id_pengguna: idPengguna },
      select: { nim: true },
    });
    if (!santri) throw this.mahasantriNotFound();

    const rows = await this.prismaService.izin.findMany({
      where: { nim: santri.nim },
      orderBy: [{ tanggal_izin: 'desc' }, { id_izin: 'desc' }],
    });
    return rows.map((row) => this.toIzinDto(row));
  }

  /**
   * Daftar izin santri binaan Musyrif yang sedang login, opsional filter
   * status. Disertai nama mahasantri pengaju.
   */
  async findByMusyrif(
    idPengguna: string,
    query: QueryMusyrifIzinDto,
  ): Promise<IzinMusyrifDto[]> {
    const musyrif = await this.resolveMusyrif(idPengguna);

    const rows = await this.prismaService.izin.findMany({
      where: {
        id_musyrif: musyrif.id_musyrif,
        ...(query.status ? { status_persetujuan: query.status } : {}),
      },
      orderBy: [{ tanggal_izin: 'desc' }, { id_izin: 'desc' }],
      include: { mahasantri: { select: { nama: true } } },
    });

    return rows.map((row) => ({
      ...this.toIzinDto(row),
      nama_mahasantri: row.mahasantri.nama,
    }));
  }

  /**
   * Verifikasi izin oleh Musyrif pembina (BR-06, BR-07).
   *
   * Urutan: 404 izin tak ada -> 403 bukan pembina -> state machine ->
   * update BERSYARAT pada status Pending supaya aman dari dua request
   * verify bersamaan: hanya satu yang mendapat count = 1; sisanya 409.
   */
  async verify(
    idPengguna: string,
    idIzin: string,
    dto: VerifyIzinDto,
  ): Promise<IzinMusyrifDto> {
    const musyrif = await this.resolveMusyrif(idPengguna);

    const izin = await this.prismaService.izin.findUnique({
      where: { id_izin: idIzin },
      include: { mahasantri: { select: { nama: true } } },
    });
    if (!izin) throw this.izinNotFound();
    if (izin.id_musyrif !== musyrif.id_musyrif) {
      throw new ForbiddenException({
        message: 'Anda bukan musyrif pembina dari mahasantri ini',
        error: 'ERR_NOT_YOUR_STUDENT',
      });
    }

    if (!canTransition(izin.status_persetujuan, dto.status_persetujuan)) {
      throw this.alreadyDecided();
    }

    const { count } = await this.prismaService.izin.updateMany({
      // Syarat status Pending inilah yang menjamin keamanan race:
      // dua request bersamaan tidak keduanya berhasil.
      where: {
        id_izin: izin.id_izin,
        status_persetujuan: StatusPersetujuan.Pending,
      },
      data: { status_persetujuan: dto.status_persetujuan },
    });

    if (count === 0) {
      // Berubah di antara fetch dan update (request lain lebih cepat) —
      // pastikan tetap 409, bukan 404, selama barisnya masih ada.
      const ulang = await this.prismaService.izin.findUnique({
        where: { id_izin: idIzin },
        select: { status_persetujuan: true },
      });
      if (!ulang) throw this.izinNotFound();
      throw this.alreadyDecided();
    }

    // TODO(tahap-11): catat aktivitas "Memverifikasi izin <nim> menjadi <status>" ke activity_logs.
    return {
      ...this.toIzinDto({ ...izin, status_persetujuan: dto.status_persetujuan }),
      nama_mahasantri: izin.mahasantri.nama,
    };
  }

  /** Resolusi profil Musyrif dari token (sub -> id_pengguna). */
  private async resolveMusyrif(idPengguna: string): Promise<{
    id_musyrif: string;
  }> {
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
    return musyrif;
  }

  private toUtcMidnight(tanggal: string): Date {
    const [year, month, day] = tanggal.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toIzinDto(row: IzinRow): IzinDto {
    return {
      id_izin: row.id_izin,
      nim: row.nim,
      jenis_izin: row.jenis_izin as IzinDto['jenis_izin'],
      tanggal_izin: row.tanggal_izin,
      alasan: row.alasan,
      bukti_lampiran: row.bukti_lampiran,
      status_persetujuan:
        row.status_persetujuan as IzinDto['status_persetujuan'],
    };
  }

  private mahasantriNotFound(): NotFoundException {
    return new NotFoundException({
      message: 'Data mahasantri tidak ditemukan',
      error: 'ERR_MAHASANTRI_NOT_FOUND',
    });
  }

  private izinNotFound(): NotFoundException {
    return new NotFoundException({
      message: 'Izin tidak ditemukan',
      error: 'ERR_IZIN_NOT_FOUND',
    });
  }

  private alreadyDecided(): ConflictException {
    return new ConflictException({
      message: 'Izin sudah pernah diputuskan dan tidak bisa diubah lagi',
      error: 'ERR_IZIN_ALREADY_DECIDED',
    });
  }
}
