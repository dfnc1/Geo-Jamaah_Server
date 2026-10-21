import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';
import {
  Role,
  StatusPresensi,
  StatusPersetujuan,
  JenisIzin,
} from '@generated/prisma/enums';
import * as bcrypt from 'bcrypt';

// ========================================
// KONEKSI DATABASE (sama pola dengan prisma/seed.ts)
// ========================================

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL belum dikonfigurasi');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ========================================
// KONSTANTA
// ========================================

const DEMO_PASSWORD = 'demouser123';

// Masjid utama — digunakan sebagai konvensi baris otomatis (masjid utama,
// koordinat 0,0) untuk baris Tidak_Hadir dan Izin.
const MASJID_UTAMA_ID = '00000000-0000-4000-8000-000000000001';
const MASJID_UTAMA_NAMA = 'Masjid Al-Ikhlas Demo';
const MASJID_UTAMA_LAT = -7.9666;
const MASJID_UTAMA_LON = 112.6326;
const MASJID_UTAMA_RADIUS = 100;

// Jadwal shalat (ID sinkron dengan prisma/seed.ts).
const JADWAL = [
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

// Rentang 30 hari terakhir, termasuk hari ini (2026-10-22), tanggal WIB.
const TODAY = '2026-10-22';
const PERIODE_START = '2026-09-23';

function generateDates(): string[] {
  const dates: string[] = [];
  let d = new Date(`${PERIODE_START}T12:00:00Z`);
  const end = new Date(`${TODAY}T12:00:00Z`);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

const DATES = generateDates(); // 30 tanggal, Sep 23 – Oct 22 2026

function wibDate(dateStr: string): Date {
  // Tengah hari UTC = 19:00 WIB, bagian tanggalnya tepat dateStr dalam WIB.
  return new Date(`${dateStr}T12:00:00Z`);
}

function jadwalByIndex(index: number): string {
  return JADWAL[index % JADWAL.length].id_jadwal;
}

// ========================================
// HELPER UPSERT PENGGUNA & PROFIL
// ========================================

async function upsertPengguna(
  username: string,
  role: Role,
  nama: string,
): Promise<{ id_pengguna: string; username: string; role: Role }> {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);

  const pengguna = await prisma.pengguna.upsert({
    where: { username },
    update: {},
    create: {
      username,
      password: hashed,
      role,
      device_id: null,
    },
  });

  return {
    id_pengguna: pengguna.id_pengguna,
    username: pengguna.username,
    role: pengguna.role,
  };
}

async function upsertMusyrif(
  username: string,
  nama: string,
  noTelepon: string,
): Promise<{ id_musyrif: string; id_pengguna: string }> {
  const pengguna = await upsertPengguna(username, Role.Musyrif, nama);

  const musyrif = await prisma.musyrif.upsert({
    where: { id_pengguna: pengguna.id_pengguna },
    update: { nama, no_telepon: noTelepon },
    create: {
      id_pengguna: pengguna.id_pengguna,
      nama,
      no_telepon: noTelepon,
    },
  });

  return { id_musyrif: musyrif.id_musyrif, id_pengguna: pengguna.id_pengguna };
}

async function upsertAdmin(username: string, nama: string): Promise<void> {
  await upsertPengguna(username, Role.Admin, nama);
}

async function upsertMahasantri(
  nim: string,
  nama: string,
  kamar: string,
  idMusyrif: string,
): Promise<void> {
  const username = `demo_${nim.toLowerCase()}`;
  const pengguna = await upsertPengguna(username, Role.Mahasantri, nama);

  await prisma.mahasantri.upsert({
    where: { nim },
    update: {
      nama,
      kamar,
      status_aktif: true,
      id_musyrif: idMusyrif,
      id_pengguna: pengguna.id_pengguna,
    },
    create: {
      nim,
      id_pengguna: pengguna.id_pengguna,
      nama,
      kamar,
      status_aktif: true,
      id_musyrif: idMusyrif,
    },
  });
}

// ========================================
// PRESENSI
// ========================================

type PresensiEntry = { date: string; status: StatusPresensi };

async function insertPresensi(
  nim: string,
  entries: PresensiEntry[],
): Promise<number> {
  let count = 0;
  for (const [index, entry] of entries.entries()) {
    const isHadir = entry.status === StatusPresensi.Hadir;
    const idJadwal = jadwalByIndex(index);

    await prisma.presensi.upsert({
      where: {
        nim_id_jadwal_tanggal: {
          nim,
          id_jadwal: idJadwal,
          tanggal: wibDate(entry.date),
        },
      },
      update: {
        status_presensi: entry.status,
        id_masjid: MASJID_UTAMA_ID,
        latitude_user: isHadir ? MASJID_UTAMA_LAT : 0,
        longitude_user: isHadir ? MASJID_UTAMA_LON : 0,
        akurasi_meter: isHadir ? 5.0 : null,
        is_mock_location: false,
        is_manual: false,
      },
      create: {
        nim,
        id_jadwal: idJadwal,
        tanggal: wibDate(entry.date),
        id_masjid: MASJID_UTAMA_ID,
        latitude_user: isHadir ? MASJID_UTAMA_LAT : 0,
        longitude_user: isHadir ? MASJID_UTAMA_LON : 0,
        akurasi_meter: isHadir ? 5.0 : null,
        is_mock_location: false,
        status_presensi: entry.status,
        is_manual: false,
      },
    });
    count += 1;
  }
  return count;
}

// Pola presensi per santri.
// Mengembalikan array entri {date, status} untuk 30 tanggal dalam periode.
function polaKritikal(): PresensiEntry[] {
  const entries: PresensiEntry[] = [];
  DATES.forEach((date, index) => {
    if (index < 15) {
      // Sep 23 – Oct 7: alternasi Hadir/Izin
      entries.push({ date, status: index % 2 === 0 ? StatusPresensi.Hadir : StatusPresensi.Izin });
    } else {
      // Oct 8 – Oct 22: semua Tidak_Hadir (streak 15 hari di akhir)
      entries.push({ date, status: StatusPresensi.Tidak_Hadir });
    }
  });
  return entries;
}

function polaBatas75(): PresensiEntry[] {
  const entries: PresensiEntry[] = [];
  DATES.forEach((date, index) => {
    if (index % 2 === 0 && index < 30) {
      entries.push({ date, status: StatusPresensi.Hadir }); // 15 Hadir
    } else if (index % 2 === 1 && index < 20) {
      entries.push({ date, status: StatusPresensi.Izin }); // 10 Izin (index 1,3,...,19)
    } else if (index % 2 === 1 && index >= 21) {
      entries.push({ date, status: StatusPresensi.Tidak_Hadir }); // 5 Tidak_Hadir (index 21,23,25,27,29)
    }
  });
  return entries;
}

function polaBanyakIzin(): PresensiEntry[] {
  const entries: PresensiEntry[] = [];
  DATES.forEach((date, index) => {
    if ([0, 2, 4, 6, 8].includes(index)) {
      entries.push({ date, status: StatusPresensi.Hadir }); // 5 Hadir
    } else {
      entries.push({ date, status: StatusPresensi.Izin }); // 25 Izin
    }
  });
  return entries;
}

function polaBanyakHadir(noToday: boolean): PresensiEntry[] {
  const entries: PresensiEntry[] = [];
  const thIndices = [5, 10, 15, 20]; // 4 Tidak_Hadir, tersebar
  const izinIndices = [7, 12, 17, 22]; // 4 Izin, tersebar

  DATES.forEach((date, index) => {
    if (noToday && index === DATES.length - 1) {
      // Tanpa presensi hari ini (Oct 22)
      return;
    }
    if (thIndices.includes(index)) {
      entries.push({ date, status: StatusPresensi.Tidak_Hadir });
    } else if (izinIndices.includes(index)) {
      entries.push({ date, status: StatusPresensi.Izin });
    } else {
      entries.push({ date, status: StatusPresensi.Hadir });
    }
  });
  return entries;
}

// ========================================
// IZIN
// ========================================

async function insertIzin(nim: string, idMusyrif: string, pattern: string): Promise<number> {
  // Hapus izin demo lama untuk nim ini (idempoten tanpa --reset juga)
  await prisma.izin.deleteMany({ where: { nim } });

  let count = 0;
  let izinIndex = 0;

  // Tentukan tanggal-tanggal yang memiliki presensi Izin untuk pola ini
  const izinDates: string[] = [];
  DATES.forEach((date, index) => {
    let isIzin = false;
    if (pattern === 'kritikal') {
      isIzin = index < 15 && index % 2 === 1; // index 1,3,5,7,9,11,13
    } else if (pattern === 'batas75') {
      isIzin = index % 2 === 1 && index < 20; // index 1,3,...,19
    } else if (pattern === 'banyakIzin') {
      isIzin = ![0, 2, 4, 6, 8].includes(index); // semua kecuali 5 tanggal Hadir
    } else if (pattern === 'banyakHadir') {
      isIzin = [7, 12, 17, 22].includes(index);
    }
    if (isIzin) {
      izinDates.push(date);
    }
  });

  for (const date of izinDates) {
    const jenis = [JenisIzin.Sakit, JenisIzin.Pulang, JenisIzin.Tugas_Kampus][
      izinIndex % 3
    ];
    izinIndex += 1;

    // Tentukan status persetujuan: sebagian Disetujui (konsisten dengan baris
    // presensi Izin), sebagian Pending dan Ditolak.
    let status: StatusPersetujuan;
    if (izinIndex <= 3) {
      status = StatusPersetujuan.Disetujui;
    } else if (izinIndex <= 5) {
      status = StatusPersetujuan.Pending;
    } else {
      status = StatusPersetujuan.Ditolak;
    }

    await prisma.izin.create({
      data: {
        nim,
        id_musyrif: idMusyrif,
        jenis_izin: jenis,
        tanggal_izin: new Date(`${date}T00:00:00Z`), // tengah malam UTC
        alasan: `Alasan izin ${jenis.toLowerCase()} tanggal ${date}`,
        bukti_lampiran: null,
        status_persetujuan: status,
      },
    });
    count += 1;
  }

  return count;
}

// ========================================
// MAIN
// ========================================

async function main() {
  const reset = process.argv.includes('--reset');
  console.log(`Memulai seed demo${reset ? ' (mode --reset)' : ''}...`);

  if (reset) {
    // Hapus semua data demo dalam urutan yang patuhi foreign key.
    await prisma.$transaction([
      prisma.presensi.deleteMany({ where: { nim: { startsWith: 'DEMO' } } }),
      prisma.izin.deleteMany({ where: { nim: { startsWith: 'DEMO' } } }),
      prisma.mahasantri.deleteMany({ where: { nim: { startsWith: 'DEMO' } } }),
      prisma.musyrif.deleteMany({ where: { nama: { startsWith: 'Demo ' } } }),
      prisma.pengguna.deleteMany({ where: { username: { startsWith: 'demo_' } } }),
    ]);
    console.log('Data demo lama (mode --reset) dihapus');
  } else {
    // Tanpa --reset: bersihkan hanya presensi & izin demo agar idempoten.
    await prisma.presensi.deleteMany({ where: { nim: { startsWith: 'DEMO' } } });
    await prisma.izin.deleteMany({ where: { nim: { startsWith: 'DEMO' } } });
    console.log('Presensi dan izin demo lama dibersihkan');
  }

  // 1. Masjid utama + jadwal shalat (idempoten, upsert)
  await prisma.masjid.upsert({
    where: { id_masjid: MASJID_UTAMA_ID },
    update: {
      nama_masjid: MASJID_UTAMA_NAMA,
      latitude: MASJID_UTAMA_LAT,
      longitude: MASJID_UTAMA_LON,
      radius_toleransi: MASJID_UTAMA_RADIUS,
    },
    create: {
      id_masjid: MASJID_UTAMA_ID,
      nama_masjid: MASJID_UTAMA_NAMA,
      latitude: MASJID_UTAMA_LAT,
      longitude: MASJID_UTAMA_LON,
      radius_toleransi: MASJID_UTAMA_RADIUS,
    },
  });

  for (const j of JADWAL) {
    const { id_jadwal, ...data } = j;
    await prisma.jadwalSholat.upsert({
      where: { id_jadwal },
      update: data,
      create: { id_jadwal, ...data },
    });
  }

  console.log('Masjid utama dan 5 jadwal sholat siap');

  // 2. Musyrif demo (2 orang)
  const musyrif1 = await upsertMusyrif(
    'musyrif_demo_1',
    'Demo Musyrif Satu',
    '081234560001',
  );
  const musyrif2 = await upsertMusyrif(
    'musyrif_demo_2',
    'Demo Musyrif Dua',
    '081234560002',
  );
  console.log('2 musyrif demo siap');

  // 3. Admin demo (untuk rekap)
  await upsertAdmin('admin_demo', 'Admin Demo');
  console.log('Admin demo siap');

  // 4. Mahasantri demo (12 orang, NIM berawalan DEMO)
  const santri = [
    { nim: 'DEMO001', nama: 'santri_demo_satu', kamar: 'D0-1', musyrif: musyrif1, pattern: 'kritikal' as const, noToday: false },
    { nim: 'DEMO002', nama: 'santri_demo_dua', kamar: 'D0-2', musyrif: musyrif1, pattern: 'batas75' as const, noToday: false },
    { nim: 'DEMO003', nama: 'santri_demo_tiga', kamar: 'D0-3', musyrif: musyrif1, pattern: 'banyakIzin' as const, noToday: false },
    { nim: 'DEMO004', nama: 'santri_demo_empat', kamar: 'D0-4', musyrif: musyrif1, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO005', nama: 'santri_demo_lima', kamar: 'D0-5', musyrif: musyrif1, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO006', nama: 'santri_demo_enam', kamar: 'D0-6', musyrif: musyrif1, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO007', nama: 'santri_demo_tujuh', kamar: 'D0-7', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO008', nama: 'santri_demo_delapan', kamar: 'D0-8', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO009', nama: 'santri_demo_sembilan', kamar: 'D0-9', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: false },
    { nim: 'DEMO010', nama: 'santri_demo_sepuluh', kamar: 'D0-10', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: true },
    { nim: 'DEMO011', nama: 'santri_demo_belas', kamar: 'D0-11', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: true },
    { nim: 'DEMO012', nama: 'santri_demo_duabelas', kamar: 'D0-12', musyrif: musyrif2, pattern: 'banyakHadir' as const, noToday: true },
  ];

  let totalPresensi = 0;
  let totalIzin = 0;

  for (const s of santri) {
    await upsertMahasantri(s.nim, s.nama, s.kamar, s.musyrif.id_musyrif);

    let entries: PresensiEntry[];
    switch (s.pattern) {
      case 'kritikal':
        entries = polaKritikal();
        break;
      case 'batas75':
        entries = polaBatas75();
        break;
      case 'banyakIzin':
        entries = polaBanyakIzin();
        break;
      case 'banyakHadir':
        entries = polaBanyakHadir(s.noToday);
        break;
      default:
        entries = polaBanyakHadir(s.noToday);
    }

    const presensiCount = await insertPresensi(s.nim, entries);
    const izinCount = await insertIzin(s.nim, s.musyrif.id_musyrif, s.pattern);
    totalPresensi += presensiCount;
    totalIzin += izinCount;
  }

  console.log(`12 mahasantri demo siap`);
  console.log(
    `Total presensi dibuat: ${totalPresensi}, total izin dibuat: ${totalIzin}`,
  );

  // Ringkasan akun demo
  console.log('\n=== AKUN DEMO ===');
  console.log('Admin:    admin_demo  /', DEMO_PASSWORD);
  console.log('Musyrif:  musyrif_demo_1 /', DEMO_PASSWORD);
  console.log('Musyrif:  musyrif_demo_2 /', DEMO_PASSWORD);
  santri.forEach((s) => {
    console.log(`Mahasantri: demo_${s.nim.toLowerCase()} /`, DEMO_PASSWORD, `(NIM ${s.nim})`);
  });
  console.log('=================\n');
}

// ========================================
// RUN
// ========================================

main()
  .catch((error) => {
    console.error('Seed demo gagal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
