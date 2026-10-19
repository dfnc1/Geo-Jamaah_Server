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
    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Masjid', <fungsi teks>) pada controller.
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

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Masjid', <fungsi teks>) pada controller.
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

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Masjid', <fungsi teks>) pada controller.
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
