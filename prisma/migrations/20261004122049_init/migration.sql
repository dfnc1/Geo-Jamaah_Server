-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Mahasantri', 'Musyrif', 'Admin');

-- CreateEnum
CREATE TYPE "StatusPresensi" AS ENUM ('Hadir', 'Tidak_Hadir', 'Izin', 'Manual');

-- CreateEnum
CREATE TYPE "JenisIzin" AS ENUM ('Sakit', 'Pulang', 'Tugas_Kampus');

-- CreateEnum
CREATE TYPE "StatusPersetujuan" AS ENUM ('Pending', 'Disetujui', 'Ditolak');

-- CreateTable
CREATE TABLE "pengguna" (
    "id_pengguna" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "device_id" TEXT,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_pengguna")
);

-- CreateTable
CREATE TABLE "musryif" (
    "id_musyrif" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "no_telepon" TEXT NOT NULL,

    CONSTRAINT "musryif_pkey" PRIMARY KEY ("id_musyrif")
);

-- CreateTable
CREATE TABLE "mahasantri" (
    "nim" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "id_musyrif" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kamar" TEXT NOT NULL,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mahasantri_pkey" PRIMARY KEY ("nim")
);

-- CreateTable
CREATE TABLE "jadwal_sholat" (
    "id_jadwal" TEXT NOT NULL,
    "nama_sholat" TEXT NOT NULL,
    "waktu_azan" TEXT NOT NULL,
    "waktu_iqamah" TEXT NOT NULL,
    "waktu_mulai_presensi" TEXT NOT NULL,
    "waktu_akhir_presensi" TEXT NOT NULL,

    CONSTRAINT "jadwal_sholat_pkey" PRIMARY KEY ("id_jadwal")
);

-- CreateTable
CREATE TABLE "masjid" (
    "id_masjid" TEXT NOT NULL,
    "nama_masjid" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_toleransi" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "masjid_pkey" PRIMARY KEY ("id_masjid")
);

-- CreateTable
CREATE TABLE "presensi" (
    "id_presensi" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "id_jadwal" TEXT NOT NULL,
    "id_masjid" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "waktu_presensi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude_user" DOUBLE PRECISION NOT NULL,
    "longitude_user" DOUBLE PRECISION NOT NULL,
    "akurasi_meter" DOUBLE PRECISION,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false,
    "status_presensi" "StatusPresensi" NOT NULL,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "alasan_kendala" TEXT,

    CONSTRAINT "presensi_pkey" PRIMARY KEY ("id_presensi")
);

-- CreateTable
CREATE TABLE "izin" (
    "id_izin" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "id_musyrif" TEXT NOT NULL,
    "jenis_izin" "JenisIzin" NOT NULL,
    "tanggal_izin" TIMESTAMP(3) NOT NULL,
    "alasan" TEXT NOT NULL,
    "bukti_lampiran" TEXT,
    "status_persetujuan" "StatusPersetujuan" NOT NULL DEFAULT 'Pending',

    CONSTRAINT "izin_pkey" PRIMARY KEY ("id_izin")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_username_key" ON "pengguna"("username");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_device_id_key" ON "pengguna"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "musryif_id_pengguna_key" ON "musryif"("id_pengguna");

-- CreateIndex
CREATE UNIQUE INDEX "mahasantri_id_pengguna_key" ON "mahasantri"("id_pengguna");

-- CreateIndex
CREATE INDEX "presensi_nim_tanggal_idx" ON "presensi"("nim", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "presensi_nim_id_jadwal_tanggal_key" ON "presensi"("nim", "id_jadwal", "tanggal");

-- CreateIndex
CREATE INDEX "izin_id_musyrif_status_persetujuan_idx" ON "izin"("id_musyrif", "status_persetujuan");

-- AddForeignKey
ALTER TABLE "musryif" ADD CONSTRAINT "musryif_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasantri" ADD CONSTRAINT "mahasantri_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasantri" ADD CONSTRAINT "mahasantri_id_musyrif_fkey" FOREIGN KEY ("id_musyrif") REFERENCES "musryif"("id_musyrif") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasantri"("nim") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_jadwal_fkey" FOREIGN KEY ("id_jadwal") REFERENCES "jadwal_sholat"("id_jadwal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_masjid_fkey" FOREIGN KEY ("id_masjid") REFERENCES "masjid"("id_masjid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin" ADD CONSTRAINT "izin_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasantri"("nim") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin" ADD CONSTRAINT "izin_id_musyrif_fkey" FOREIGN KEY ("id_musyrif") REFERENCES "musryif"("id_musyrif") ON DELETE RESTRICT ON UPDATE CASCADE;
