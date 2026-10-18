import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { Prisma, Role } from '@generated/prisma/client';
import { potongUsername, potongTeks } from './audit-teks';
import { awalHariWib, akhirHariWib } from './hari-wib';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';
import { ActivityLogsPageDto, ActivityLogDto } from './dto/activity-log.dto';

export interface CatatAktivitasDto {
  username: string;
  role: Role;
  modul: string;
  aktivitas: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Tulis satu baris activity log (BR-11). FIRE-AND-FORGET: kegagalan
   * menulis TIDAK PERNAH melempar error — hanya Logger.warn — supaya
   * request utama tidak terpengaruh. `username` dipotong maks 100
   * karakter (kolom VarChar(100)), `aktivitas` maks 500 karakter.
   *
   * Kebijakan keamanan: fungsi ini hanya menerima `CatatAktivitasDto`
   * (username, role, modul, aktivitas). Password, token, dan field
   * sensitif lain TIDAK PERNAH diteruskan ke sini — teks aktivitas
   * dibangun oleh fungsi murni `audit-teks.ts` yang hanya memilih field
   * yang diizinkan secara eksplisit.
   */
  catat(dto: CatatAktivitasDto): void {
    const data = {
      username: potongUsername(dto.username),
      role: dto.role,
      modul: dto.modul,
      aktivitas: potongTeks(dto.aktivitas),
    };

    // Fire-and-forget: jangan await, jangan throw.
    this.prismaService.activityLog
      .create({ data })
      .catch((e: unknown) => {
        this.logger.warn(
          `Gagal menulis activity log (modul ${dto.modul}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      });
  }

  /**
   * Cari activity log dengan filter + pagination (BR-11). Hanya dipanggil
   * oleh Admin melalui GET /v1/admin/activity-logs. Urut: created_at desc,
   * lalu id_log desc (stabil). `from`/`to` ditafsirkan sebagai hari WIB
   * (UTC+7): `from` >= awal hari WIB, `to` < awal hari WIB berikutnya.
   */
  async cari(filter: QueryActivityLogsDto): Promise<ActivityLogsPageDto> {
    const where = this.bangunWhere(filter);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const [total, rows] = await Promise.all([
      this.prismaService.activityLog.count({ where }),
      this.prismaService.activityLog.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id_log: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      logs: rows.map((row) => this.toDto(row)),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }

  /** Bangun objek `where` Prisma dari filter query DTO. */
  private bangunWhere(
    filter: QueryActivityLogsDto,
  ): Prisma.ActivityLogWhereInput {
    const where: Prisma.ActivityLogWhereInput = {};

    if (filter.role !== undefined) where.role = filter.role;
    if (filter.username !== undefined) where.username = filter.username;
    if (filter.modul !== undefined) where.modul = filter.modul;

    // Filter rentang tanggal WIB: from >= awal hari WIB, to < awal hari
    // WIB berikutnya (inklusif sepanjang hari WIB).
    if (filter.from !== undefined || filter.to !== undefined) {
      const created_at: Prisma.DateTimeFilter = {};
      if (filter.from !== undefined) created_at.gte = awalHariWib(filter.from);
      if (filter.to !== undefined) created_at.lt = akhirHariWib(filter.to);
      where.created_at = created_at;
    }

    return where;
  }

  private toDto(row: {
    id_log: string;
    username: string;
    role: Role;
    modul: string;
    aktivitas: string;
    created_at: Date;
  }): ActivityLogDto {
    return {
      id_log: row.id_log,
      username: row.username,
      role: row.role,
      modul: row.modul,
      aktivitas: row.aktivitas,
      created_at: row.created_at,
    };
  }
}
