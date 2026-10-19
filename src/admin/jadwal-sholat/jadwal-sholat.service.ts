import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { JadwalSholat } from '@generated/prisma/client';
import { CreateJadwalSholatDto } from './dto/create-jadwal-sholat.dto';
import { UpdateJadwalSholatDto } from './dto/update-jadwal-sholat.dto';
import { assertPresensiWindowValid } from './dto/presensi-window';

@Injectable()
export class JadwalSholatService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateJadwalSholatDto): Promise<JadwalSholat> {
    assertPresensiWindowValid(dto.waktu_mulai_presensi, dto.waktu_akhir_presensi);

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Jadwal', <fungsi teks>) pada controller.
    return this.prismaService.jadwalSholat.create({ data: dto });
  }

  async findAll(): Promise<JadwalSholat[]> {
    return this.prismaService.jadwalSholat.findMany({
      orderBy: { waktu_azan: 'asc' },
    });
  }

  async findOne(idJadwal: string): Promise<JadwalSholat> {
    const jadwal = await this.prismaService.jadwalSholat.findUnique({
      where: { id_jadwal: idJadwal },
    });

    if (!jadwal) throw this.notFound();
    return jadwal;
  }

  async update(
    idJadwal: string,
    dto: UpdateJadwalSholatDto,
  ): Promise<JadwalSholat> {
    const existing = await this.findOne(idJadwal);

    // PATCH sebagian: field yang tidak dikirim memakai nilai tersimpan,
    // supaya aturan window presensi tetap berlaku pada pasangan nilai final.
    assertPresensiWindowValid(
      dto.waktu_mulai_presensi ?? existing.waktu_mulai_presensi,
      dto.waktu_akhir_presensi ?? existing.waktu_akhir_presensi,
    );

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Jadwal', <fungsi teks>) pada controller.
    return this.prismaService.jadwalSholat.update({
      where: { id_jadwal: idJadwal },
      data: dto,
    });
  }

  async remove(idJadwal: string): Promise<{ id_jadwal: string }> {
    await this.findOne(idJadwal);

    const dipakai = await this.prismaService.presensi.count({
      where: { id_jadwal: idJadwal },
    });

    if (dipakai > 0) {
      throw new ConflictException({
        message: 'Jadwal sholat masih dipakai oleh data presensi, tidak bisa dihapus',
        error: 'ERR_IN_USE',
      });
    }

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Jadwal', <fungsi teks>) pada controller.
    await this.prismaService.jadwalSholat.delete({
      where: { id_jadwal: idJadwal },
    });
    return { id_jadwal: idJadwal };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      message: 'Jadwal sholat tidak ditemukan',
      error: 'ERR_JADWAL_NOT_FOUND',
    });
  }
}
