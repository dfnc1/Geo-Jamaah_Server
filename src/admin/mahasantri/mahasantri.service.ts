import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { ResetDeviceResponseDto } from './dto/reset-device.dto';

@Injectable()
export class MahasantriService {
  private readonly logger = new Logger(MahasantriService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Reset `device_id` pengguna milik Mahasantri tertentu menjadi null,
   * sehingga santri bisa mengikat ulang akunnya ke perangkat baru.
   *
   * Saat ini hanya Admin (BR-09); hak akses Musyrif untuk santri binaannya
   * dipertimbangkan kembali bersama endpoint reset device (backlog P2).
   */
  async resetDevice(nim: string): Promise<ResetDeviceResponseDto> {
    const mahasantri = await this.prismaService.mahasantri.findUnique({
      where: { nim },
      include: {
        pengguna: {
          select: { id_pengguna: true, username: true, device_id: true },
        },
      },
    });

    if (!mahasantri) {
      throw new NotFoundException({
        message: 'Mahasantri tidak ditemukan',
        error: 'ERR_MAHASANTRI_NOT_FOUND',
      });
    }

    // Activity log dicatat oleh interceptor global (ActivityLogInterceptor)
    // yang membaca metadata @Audit('Mahasantri', <fungsi teks>) pada controller.
    const updated = await this.prismaService.pengguna.update({
      where: { id_pengguna: mahasantri.pengguna.id_pengguna },
      data: { device_id: null },
      select: { device_id: true },
    });

    this.logger.warn(
      `Reset device untuk Mahasantri ${nim} (pengguna ${mahasantri.pengguna.id_pengguna}): ` +
        `device_id lama "${mahasantri.pengguna.device_id ?? '(belum terikat)'}" dihapus`,
    );

    return {
      nim: mahasantri.nim,
      nama: mahasantri.nama,
      username: mahasantri.pengguna.username,
      device_id: updated.device_id,
    };
  }
}
