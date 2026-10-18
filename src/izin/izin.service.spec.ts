import { HttpException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { JenisIzin, StatusPersetujuan } from '@generated/prisma/enums';
import { IzinService } from './izin.service';
import { CreateIzinDto } from './dto/create-izin.dto';
import { QueryMusyrifIzinDto } from './dto/query-musyrif-izin.dto';
import { VerifyIzinDto } from './dto/verify-izin.dto';

// PrismaService dibutuhkan runtime oleh Nest sebagai value (metadata
// design:paramtypes), sehingga mengimpornya menarik dependensi berat/ESM
// (@nestjs/config, adapter-pg, client Prisma). Unit test ini tidak
// membutuhkannya — cukup dimock supaya suite tetap jalan di mode CJS.
jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

/** PrismaService versi mock: hanya method yang dipakai IzinService. */
function createPrismaMock() {
  return {
    mahasantri: { findUnique: jest.fn() },
    musyrif: { findUnique: jest.fn() },
    izin: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

/** Tangkap exception lalu verifikasi status HTTP + kode error kontrak. */
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
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(statusCode);
  expect((caught as HttpException).getResponse()).toMatchObject({
    error: errorCode,
  });
}

const CREATE_DTO: CreateIzinDto = {
  jenis_izin: JenisIzin.Sakit,
  tanggal_izin: '2026-10-05',
  alasan: 'Sakit demam',
};

const VERIFY_DTO: VerifyIzinDto = {
  status_persetujuan: StatusPersetujuan.Disetujui,
};

const SANTRI = { nim: '24050505050', id_musyrif: 'musyrif-binaan' };

function izinRow(status: StatusPersetujuan = StatusPersetujuan.Pending) {
  return {
    id_izin: 'izin-1',
    nim: SANTRI.nim,
    id_musyrif: SANTRI.id_musyrif,
    jenis_izin: JenisIzin.Sakit,
    tanggal_izin: new Date('2026-10-05T00:00:00.000Z'),
    alasan: 'Sakit demam',
    bukti_lampiran: null,
    status_persetujuan: status,
    mahasantri: { nama: 'santri_satu' },
  };
}

describe('IzinService', () => {
  let prisma: PrismaMock;
  let service: IzinService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new IzinService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.mahasantri.findUnique.mockResolvedValue(SANTRI);
    });

    it('mengisi id_musyrif dari pembina dan status Pending', async () => {
      prisma.izin.create.mockResolvedValue(izinRow());

      const hasil = await service.create('pengguna-1', CREATE_DTO);

      expect(prisma.izin.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nim: SANTRI.nim,
          id_musyrif: SANTRI.id_musyrif,
          jenis_izin: JenisIzin.Sakit,
          alasan: 'Sakit demam',
          bukti_lampiran: null,
          status_persetujuan: StatusPersetujuan.Pending,
        }),
      });
      expect(hasil.status_persetujuan).toBe(StatusPersetujuan.Pending);
      expect(hasil.id_izin).toBe('izin-1');
    });

    it('mengonversi tanggal_izin YYYY-MM-DD ke Date tengah-malam UTC', async () => {
      prisma.izin.create.mockResolvedValue(izinRow());

      await service.create('pengguna-1', CREATE_DTO);

      const data = prisma.izin.create.mock.calls[0][0].data;
      expect(data.tanggal_izin).toEqual(new Date('2026-10-05T00:00:00.000Z'));
    });

    it('meneruskan bukti_lampiran bila dikirim', async () => {
      prisma.izin.create.mockResolvedValue(izinRow());

      await service.create('pengguna-1', {
        ...CREATE_DTO,
        bukti_lampiran: 'izin/24050505050/2026-10-05.jpg',
      });

      const data = prisma.izin.create.mock.calls[0][0].data;
      expect(data.bukti_lampiran).toBe('izin/24050505050/2026-10-05.jpg');
    });

    it('404 ERR_MAHASANTRI_NOT_FOUND bila profil tidak ada', async () => {
      prisma.mahasantri.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.create('pengguna-hilang', CREATE_DTO),
        404,
        'ERR_MAHASANTRI_NOT_FOUND',
      );
      expect(prisma.izin.create).not.toHaveBeenCalled();
    });
  });

  describe('findSaya', () => {
    it('memfilter milik sendiri dan mengurutkan terbaru dulu', async () => {
      prisma.mahasantri.findUnique.mockResolvedValue(SANTRI);
      prisma.izin.findMany.mockResolvedValue([izinRow()]);

      const hasil = await service.findSaya('pengguna-1');

      expect(prisma.mahasantri.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_pengguna: 'pengguna-1' } }),
      );
      expect(prisma.izin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nim: SANTRI.nim },
          orderBy: [{ tanggal_izin: 'desc' }, { id_izin: 'desc' }],
        }),
      );
      expect(hasil).toHaveLength(1);
      expect(hasil[0].nim).toBe(SANTRI.nim);
    });
  });

  describe('findByMusyrif', () => {
    beforeEach(() => {
      prisma.musyrif.findUnique.mockResolvedValue({
        id_musyrif: SANTRI.id_musyrif,
      });
      prisma.izin.findMany.mockResolvedValue([izinRow()]);
    });

    it('hanya mengambil izin milik musyrif tersebut', async () => {
      const query: QueryMusyrifIzinDto = { status: StatusPersetujuan.Pending };

      await service.findByMusyrif('pengguna-1', query);

      expect(prisma.izin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id_musyrif: SANTRI.id_musyrif,
            status_persetujuan: StatusPersetujuan.Pending,
          },
        }),
      );
    });

    it('tanpa query status, semua status ikut tampil', async () => {
      await service.findByMusyrif('pengguna-1', {});

      expect(prisma.izin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_musyrif: SANTRI.id_musyrif },
        }),
      );
    });

    it('menyertakan nama_mahasantri pada tiap baris', async () => {
      const hasil = await service.findByMusyrif('pengguna-1', {});
      expect(hasil[0].nama_mahasantri).toBe('santri_satu');
    });

    it('404 ERR_MUSYRIF_NOT_FOUND bila profil musyrif tak ada', async () => {
      prisma.musyrif.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.findByMusyrif('pengguna-1', {}),
        404,
        'ERR_MUSYRIF_NOT_FOUND',
      );
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      prisma.musyrif.findUnique.mockResolvedValue({
        id_musyrif: SANTRI.id_musyrif,
      });
    });

    it('mengubah Pending menjadi Disetujui via update bersyarat', async () => {
      prisma.izin.findUnique.mockResolvedValue(izinRow());
      prisma.izin.updateMany.mockResolvedValue({ count: 1 });

      const hasil = await service.verify(
        'pengguna-1',
        'izin-1',
        VERIFY_DTO,
      );

      expect(prisma.izin.updateMany).toHaveBeenCalledWith({
        where: {
          id_izin: 'izin-1',
          status_persetujuan: StatusPersetujuan.Pending,
        },
        data: { status_persetujuan: StatusPersetujuan.Disetujui },
      });
      expect(hasil.status_persetujuan).toBe(StatusPersetujuan.Disetujui);
      expect(hasil.nama_mahasantri).toBe('santri_satu');
    });

    it('404 ERR_IZIN_NOT_FOUND bila izin tidak ada', async () => {
      prisma.izin.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.verify('pengguna-1', 'tidak-ada', VERIFY_DTO),
        404,
        'ERR_IZIN_NOT_FOUND',
      );
      expect(prisma.izin.updateMany).not.toHaveBeenCalled();
    });

    it('403 ERR_NOT_YOUR_STUDENT untuk musyrif bukan pembina', async () => {
      prisma.izin.findUnique.mockResolvedValue({
        ...izinRow(),
        id_musyrif: 'musyrif-lain',
      });

      await expectRejection(
        service.verify('pengguna-1', 'izin-1', VERIFY_DTO),
        403,
        'ERR_NOT_YOUR_STUDENT',
      );
      expect(prisma.izin.updateMany).not.toHaveBeenCalled();
    });

    it('409 ERR_IZIN_ALREADY_DECIDED bila izin sudah Disetujui', async () => {
      prisma.izin.findUnique.mockResolvedValue(
        izinRow(StatusPersetujuan.Disetujui),
      );

      await expectRejection(
        service.verify('pengguna-1', 'izin-1', VERIFY_DTO),
        409,
        'ERR_IZIN_ALREADY_DECIDED',
      );
      expect(prisma.izin.updateMany).not.toHaveBeenCalled();
    });

    it('409 ERR_IZIN_ALREADY_DECIDED bila state machine menolak transisi', async () => {
      // Ditolak -> Disetujui tidak sah (BR-07)
      prisma.izin.findUnique.mockResolvedValue(
        izinRow(StatusPersetujuan.Ditolak),
      );

      await expectRejection(
        service.verify('pengguna-1', 'izin-1', VERIFY_DTO),
        409,
        'ERR_IZIN_ALREADY_DECIDED',
      );
    });

    it('race: update bersyarat kalah (count 0) -> refetch -> 409', async () => {
      // Fetch pertama masih Pending, tetapi request lain lebih cepat.
      prisma.izin.findUnique
        .mockResolvedValueOnce(izinRow())
        .mockResolvedValueOnce(izinRow(StatusPersetujuan.Disetujui));
      prisma.izin.updateMany.mockResolvedValue({ count: 0 });

      await expectRejection(
        service.verify('pengguna-1', 'izin-1', VERIFY_DTO),
        409,
        'ERR_IZIN_ALREADY_DECIDED',
      );
      // Tidak pernah memakai update tanpa syarat status Pending.
      expect(prisma.izin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status_persetujuan: StatusPersetujuan.Pending,
          }),
        }),
      );
    });

    it('404 bila baris hilang di antara fetch dan update', async () => {
      prisma.izin.findUnique
        .mockResolvedValueOnce(izinRow())
        .mockResolvedValueOnce(null);
      prisma.izin.updateMany.mockResolvedValue({ count: 0 });

      await expectRejection(
        service.verify('pengguna-1', 'izin-1', VERIFY_DTO),
        404,
        'ERR_IZIN_NOT_FOUND',
      );
    });
  });
});
