import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';
import { StatusPresensi, StatusPersetujuan } from '@generated/prisma/enums';
import { toWibDate, toWibHHmm } from '@src/presensi/wib-time';
import { TandaiTidakHadirService } from './tandai-tidak-hadir.service';

// PrismaService dibutuhkan runtime oleh Nest sebagai value (metadata
// design:paramtypes), sehingga mengimpornya menarik dependensi berat/ESM.
// Unit test ini tidak membutuhkannya — cukup dimock (pola izin.service.spec).
jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

// @nestjs/schedule berbasis ESM; unit test ini hanya perlu dekorator @Cron
// sebagai no-op (pola sama dengan mock @nestjs/passport di spec guard).
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

function createPrismaMock() {
  return {
    jadwalSholat: { findMany: jest.fn(), findUnique: jest.fn() },
    masjid: { findFirst: jest.fn() },
    mahasantri: { findMany: jest.fn() },
    presensi: { findMany: jest.fn(), createMany: jest.fn(), create: jest.fn() },
    izin: { findMany: jest.fn() },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

const MASJID_UTAMA = {
  id_masjid: 'masjid-1',
  nama_masjid: 'Al-Ikhlas',
  latitude: -7.9671,
  longitude: 112.6326,
  radius_toleransi: 100,
};

const SANTRI_AKTIF = { nim: '24050505050', status_aktif: true };
const SANTRI_NONAKTIF = { nim: '24050505051', status_aktif: false };

function jadwal(idJadwal: string, akhir: string) {
  return {
    id_jadwal: idJadwal,
    nama_sholat: 'Dzuhur',
    waktu_azan: '11:30',
    waktu_iqamah: '11:45',
    waktu_mulai_presensi: '11:45',
    waktu_akhir_presensi: akhir,
  };
}

async function expectRejection(
  promise: Promise<unknown>,
  statusCode: number,
  errorCode: string,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(HttpExceptionLike(statusCode));
  const res = (caught as { getResponse: () => unknown }).getResponse();
  expect(res).toMatchObject({ error: errorCode });
}

/** Pilih exception class yang sesuai agar pesan assertion tetap jelas. */
function HttpExceptionLike(statusCode: number) {
  return statusCode === 404 ? NotFoundException : BadRequestException;
}

/** Error P2002 buatan untuk menguji jalur fallback per baris. */
function p2002(): Error {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    { code: 'P2002' },
  ) as Error;
}

describe('TandaiTidakHadirService', () => {
  let prisma: PrismaMock;
  let service: TandaiTidakHadirService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new TandaiTidakHadirService(
      prisma as unknown as PrismaService,
    );
    prisma.masjid.findFirst.mockResolvedValue(MASJID_UTAMA);
    prisma.presensi.findMany.mockResolvedValue([]);
    prisma.izin.findMany.mockResolvedValue([]);
    prisma.presensi.createMany.mockImplementation(
      ({ data }: { data: unknown[] }) => Promise.resolve({ count: data.length }),
    );
    prisma.presensi.create.mockResolvedValue({});
    prisma.mahasantri.findMany.mockResolvedValue([SANTRI_AKTIF]);
    prisma.jadwalSholat.findMany.mockResolvedValue([jadwal('jadwal-1', '00:00')]);
  });

  describe('jalankan (pemicu manual)', () => {
    it('membuat Tidak_Hadir tanpa izin, dengan masjid utama dan koordinat 0,0', async () => {
      const hasil = await service.jalankan({});

      expect(prisma.izin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status_persetujuan: StatusPersetujuan.Disetujui,
            tanggal_izin: toWibDate(new Date()),
          },
        }),
      );
      expect(prisma.presensi.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            nim: SANTRI_AKTIF.nim,
            id_jadwal: 'jadwal-1',
            id_masjid: MASJID_UTAMA.id_masjid,
            latitude_user: 0,
            longitude_user: 0,
            is_mock_location: false,
            is_manual: false,
            status_presensi: StatusPresensi.Tidak_Hadir,
          }),
        ],
        skipDuplicates: true,
      });
      expect(hasil).toEqual({
        tanggal: toWibDate(new Date()).toISOString().slice(0, 10),
        id_jadwal: null,
        dibuat: { Tidak_Hadir: 1, Izin: 0 },
        total_dibuat: 1,
      });
    });

    it('membuat Izin bila ada izin Disetujui pada tanggal itu', async () => {
      prisma.izin.findMany.mockResolvedValue([{ nim: SANTRI_AKTIF.nim }]);

      const hasil = await service.jalankan({});

      expect(hasil.dibuat).toEqual({ Tidak_Hadir: 0, Izin: 1 });
      expect(prisma.presensi.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              status_presensi: StatusPresensi.Izin,
            }),
          ],
        }),
      );
    });

    it('melewati santri yang sudah punya presensi (tidak menimpa Hadir)', async () => {
      prisma.mahasantri.findMany.mockResolvedValue([
        SANTRI_AKTIF,
        { nim: '24050505052', status_aktif: true },
      ]);
      // Baris Hadir sudah ada untuk SANTRI_AKTIF.
      prisma.presensi.findMany.mockResolvedValue([{ nim: SANTRI_AKTIF.nim }]);

      const hasil = await service.jalankan({});

      const data = prisma.presensi.createMany.mock.calls[0][0].data as Array<{
        nim: string;
      }>;
      expect(data.map((b) => b.nim)).toEqual(['24050505052']);
      expect(hasil.total_dibuat).toBe(1);
    });

    it('melewati santri nonaktif', async () => {
      prisma.mahasantri.findMany.mockResolvedValue([SANTRI_NONAKTIF]);

      const hasil = await service.jalankan({});

      expect(prisma.presensi.createMany).not.toHaveBeenCalled();
      expect(hasil.total_dibuat).toBe(0);
    });

    it('tanggal lampau memproses semua jadwal (backfill)', async () => {
      await service.jalankan({ tanggal: '2020-01-01' });

      // Tanpa filter waktu — hari sudah berlalu sepenuhnya.
      expect(prisma.jadwalSholat.findMany).toHaveBeenCalledWith();
    });

    it('404 ERR_JADWAL_NOT_FOUND untuk id_jadwal yang tidak ada', async () => {
      prisma.jadwalSholat.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.jalankan({ id_jadwal: '00000000-0000-4000-8000-0000000000aa' }),
        404,
        'ERR_JADWAL_NOT_FOUND',
      );
    });

    it('400 ERR_TIME_WINDOW_INVALID bila jadwal hari ini belum melewati akhir', async () => {
      prisma.jadwalSholat.findUnique.mockResolvedValue(jadwal('jadwal-1', '23:59'));

      await expectRejection(
        service.jalankan({ id_jadwal: 'jadwal-1' }),
        400,
        'ERR_TIME_WINDOW_INVALID',
      );
    });

    it('400 ERR_VALIDATION untuk tanggal di masa depan', async () => {
      const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tanggal = toWibDate(besok).toISOString().slice(0, 10);

      await expectRejection(
        service.jalankan({ tanggal }),
        400,
        'ERR_VALIDATION',
      );
    });

    it('satu jadwal gagal tidak menghentikan jadwal lain (isolasi error)', async () => {
      prisma.jadwalSholat.findMany.mockResolvedValue([
        jadwal('jadwal-gagal', '00:00'),
        jadwal('jadwal-ok', '00:00'),
      ]);
      // Jadwal pertama gagal: tidak ada masjid utama saat itu.
      prisma.masjid.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MASJID_UTAMA);

      const hasil = await service.jalankan({});

      expect(hasil.dibuat).toEqual({ Tidak_Hadir: 1, Izin: 0 });
    });

    it('melempar error bila semua jadwal yang diminta gagal', async () => {
      prisma.masjid.findFirst.mockResolvedValue(null);
      prisma.jadwalSholat.findUnique.mockResolvedValue(jadwal('jadwal-1', '00:00'));

      await expect(
        service.jalankan({ id_jadwal: 'jadwal-1' }),
      ).rejects.toThrow('Tidak ada data masjid');
    });
  });

  describe('fallback per baris', () => {
    beforeEach(() => {
      prisma.mahasantri.findMany.mockResolvedValue([
        SANTRI_AKTIF,
        { nim: '24050505052', status_aktif: true },
      ]);
      prisma.presensi.createMany.mockRejectedValue(new Error('db error'));
    });

    it('menyisipkan per baris saat createMany gagal', async () => {
      const hasil = await service.jalankan({});

      expect(prisma.presensi.create).toHaveBeenCalledTimes(2);
      expect(hasil.dibuat).toEqual({ Tidak_Hadir: 2, Izin: 0 });
    });

    it('P2002 dilewati dan baris lain tetap dibuat', async () => {
      prisma.presensi.create
        .mockRejectedValueOnce(p2002())
        .mockResolvedValue({});

      const hasil = await service.jalankan({});

      expect(prisma.presensi.create).toHaveBeenCalledTimes(2);
      expect(hasil.total_dibuat).toBe(1);
    });

    it('error non-P2002 dicatat dan baris lain tetap dicoba', async () => {
      prisma.presensi.create
        .mockRejectedValueOnce(new Error('kolom aneh'))
        .mockResolvedValue({});

      const hasil = await service.jalankan({});

      expect(hasil.total_dibuat).toBe(1);
    });
  });

  describe('handleCron', () => {
    it('hanya memproses jadwal yang akhirnya sudah lewat, sekali per hari', async () => {
      prisma.jadwalSholat.findMany.mockResolvedValue([
        jadwal('jadwal-1', '00:00'),
      ]);

      await service.handleCron();
      await service.handleCron();

      // Kedua run memanggil query, tetapi sisipan hanya terjadi sekali
      // berkat cache in-memory (idempoten).
      expect(prisma.presensi.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.jadwalSholat.findMany).toHaveBeenCalledWith({
        where: { waktu_akhir_presensi: { lte: toWibHHmm(new Date()) } },
      });
    });

    it('gagal pada satu jadwal tetap memproses jadwal lain dan tidak melempar', async () => {
      prisma.jadwalSholat.findMany.mockResolvedValue([
        jadwal('jadwal-gagal', '00:00'),
        jadwal('jadwal-ok', '00:00'),
      ]);
      prisma.masjid.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MASJID_UTAMA);

      await expect(service.handleCron()).resolves.toBeUndefined();

      expect(prisma.presensi.createMany).toHaveBeenCalledTimes(1);
    });

    it('tidak mati meski kueri jadwal gagal total', async () => {
      prisma.jadwalSholat.findMany.mockRejectedValue(new Error('db mati'));

      await expect(service.handleCron()).resolves.toBeUndefined();
    });
  });
});
