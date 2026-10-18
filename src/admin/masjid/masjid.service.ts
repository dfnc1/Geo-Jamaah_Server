import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { Masjid } from '@generated/prisma/client';
import { CreateMasjidDto } from './dto/create-masjid.dto';
import { UpdateMasjidDto } from './dto/update-masjid.dto';

@Injectable()
export class MasjidService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateMasjidDto): Promise<Masjid> {
    // TODO(tahap-11): catat aktivitas "Membuat masjid <nama>" ke activity_logs.
    return this.prismaService.masjid.create({ data: dto });
  }

  async findAll(): Promise<Masjid[]> {
    return this.prismaService.masjid.findMany({
      orderBy: { nama_masjid: 'asc' },
    });
  }

  async findOne(idMasjid: string): Promise<Masjid> {
    const masjid = await this.prismaService.masjid.findUnique({
      where: { id_masjid: idMasjid },
    });

    if (!masjid) throw this.notFound();
    return masjid;
  }

  async update(idMasjid: string, dto: UpdateMasjidDto): Promise<Masjid> {
    await this.findOne(idMasjid);

    // TODO(tahap-11): catat aktivitas "Mengubah data masjid <nama>" (mis. radius toleransi) ke activity_logs.
    return this.prismaService.masjid.update({
      where: { id_masjid: idMasjid },
      data: dto,
    });
  }

  async remove(idMasjid: string): Promise<{ id_masjid: string }> {
    await this.findOne(idMasjid);

    const dipakai = await this.prismaService.presensi.count({
      where: { id_masjid: idMasjid },
    });

    if (dipakai > 0) {
      throw new ConflictException({
        message: 'Masjid masih dipakai oleh data presensi, tidak bisa dihapus',
        error: 'ERR_IN_USE',
      });
    }

    // TODO(tahap-11): catat aktivitas "Menghapus masjid <nama>" ke activity_logs.
    await this.prismaService.masjid.delete({ where: { id_masjid: idMasjid } });
    return { id_masjid: idMasjid };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      message: 'Masjid tidak ditemukan',
      error: 'ERR_MASJID_NOT_FOUND',
    });
  }
}
