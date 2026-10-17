import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';
import { Role } from '@generated/prisma/enums';
import * as bcrypt from 'bcrypt';

// ========================================
// DATABASE CONNECTION
// ========================================

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL belum dikonfigurasi');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ========================================
// MAIN SEED
// ========================================

async function main() {
  console.log('Memulai seeding...');

  // ======================================
  // 1. ADMIN
  // ======================================

  await prisma.pengguna.upsert({
    where: {
      username: 'admin',
    },
    update: {},
    create: {
      username: 'admin',
      password: await bcrypt.hash('admin123', 12),
      role: Role.Admin,
      device_id: null,
    },
  });

  console.log('Admin berhasil di-seed');

  // ======================================
  // 2. MUSYRIF
  // ======================================

  const musyrif1 = await prisma.pengguna.upsert({
    where: {
      username: 'musyrif1',
    },
    update: {},
    create: {
      username: 'musyrif1',
      password: await bcrypt.hash('12345678', 12),
      role: Role.Musyrif,
      device_id: null,
      musyrif: {
        create: {
          nama: 'musyrif_satu',
          no_telepon: '081234560987',
        },
      },
    },
    include: {
      musyrif: true,
    },
  });

  if (!musyrif1.musyrif) {
    throw new Error(
      'Profil musyrif1 belum tersedia. Periksa data pengguna dan profil musyrif.',
    );
  }

  console.log('Musyrif berhasil di-seed');

  // ======================================
  // 3. MAHASANTRI 1
  // ======================================

  await prisma.pengguna.upsert({
    where: {
      username: 'mahasantri1',
    },
    update: {},
    create: {
      username: 'mahasantri1',
      password: await bcrypt.hash('12345678', 12),
      role: Role.Mahasantri,
      device_id: null,
      mahasantri: {
        create: {
          nim: '24050505050',
          nama: 'santri_satu',
          kamar: 'A0-1',
          status_aktif: true,
          musyrif: {
            connect: {
              id_musyrif: musyrif1.musyrif.id_musyrif,
            },
          },
        },
      },
    },
  });

  // ======================================
  // 4. MAHASANTRI 2
  // ======================================

  await prisma.pengguna.upsert({
    where: {
      username: 'mahasantri2',
    },
    update: {},
    create: {
      username: 'mahasantri2',
      password: await bcrypt.hash('12345678', 12),
      role: Role.Mahasantri,
      device_id: null,
      mahasantri: {
        create: {
          nim: '24060505051',
          nama: 'santri_dua',
          kamar: 'A1-1',
          status_aktif: false,
          musyrif: {
            connect: {
              id_musyrif: musyrif1.musyrif.id_musyrif,
            },
          },
        },
      },
    },
  });

  // ======================================
  // 5. MAHASANTRI 3
  // ======================================

  await prisma.pengguna.upsert({
    where: {
      username: 'mahasantri3',
    },
    update: {},
    create: {
      username: 'mahasantri3',
      password: await bcrypt.hash('12345678', 12),
      role: Role.Mahasantri,
      device_id: null,
      mahasantri: {
        create: {
          nim: '24060505092',
          nama: 'santri_tiga',
          kamar: 'A1-1',
          status_aktif: true,
          musyrif: {
            connect: {
              id_musyrif: musyrif1.musyrif.id_musyrif,
            },
          },
        },
      },
    },
  });

  console.log('Mahasantri berhasil di-seed');

  // ======================================
  // 6. MASJID
  // ======================================

  const masjidId = '00000000-0000-4000-8000-000000000001';

  await prisma.masjid.upsert({
    where: {
      id_masjid: masjidId,
    },
    update: {
      nama_masjid: 'Masjid Al-Ikhlas',
      latitude: -7.9666,
      longitude: 112.6326,
      radius_toleransi: 100,
    },
    create: {
      id_masjid: masjidId,
      nama_masjid: 'Masjid Al-Ikhlas',
      latitude: -7.9666,
      longitude: 112.6326,
      radius_toleransi: 100,
    },
  });

  console.log('Masjid berhasil di-seed');

  // ======================================
  // 7. JADWAL SHOLAT
  // ======================================

  const jadwalSholat = [
    {
      id_jadwal: '00000000-0000-4000-8000-000000000101',
      nama_sholat: 'Subuh',
      waktu_azan: '04:30',
      waktu_iqamah: '04:45',
      waktu_mulai_presensi: '04:15',
      waktu_akhir_presensi: '05:10',
    },
    {
      id_jadwal: '00000000-0000-4000-8000-000000000102',
      nama_sholat: 'Dzuhur',
      waktu_azan: '11:45',
      waktu_iqamah: '12:00',
      waktu_mulai_presensi: '11:30',
      waktu_akhir_presensi: '12:30',
    },
    {
      id_jadwal: '00000000-0000-4000-8000-000000000103',
      nama_sholat: 'Ashar',
      waktu_azan: '15:00',
      waktu_iqamah: '15:15',
      waktu_mulai_presensi: '14:45',
      waktu_akhir_presensi: '15:45',
    },
    {
      id_jadwal: '00000000-0000-4000-8000-000000000104',
      nama_sholat: 'Maghrib',
      waktu_azan: '17:40',
      waktu_iqamah: '17:45',
      waktu_mulai_presensi: '17:30',
      waktu_akhir_presensi: '18:10',
    },
    {
      id_jadwal: '00000000-0000-4000-8000-000000000105',
      nama_sholat: 'Isya',
      waktu_azan: '18:50',
      waktu_iqamah: '19:05',
      waktu_mulai_presensi: '18:40',
      waktu_akhir_presensi: '19:30',
    },
  ];

  for (const jadwal of jadwalSholat) {
    const { id_jadwal, ...data } = jadwal;

    await prisma.jadwalSholat.upsert({
      where: {
        id_jadwal,
      },
      update: data,
      create: {
        id_jadwal,
        ...data,
      },
    });
  }

  console.log('5 jadwal sholat berhasil di-seed');
  console.log('Semua seeding berhasil!');
}

// ========================================
// RUN SEED
// ========================================

main()
  .catch((error) => {
    console.error('Seeding gagal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
