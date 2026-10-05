/*
  Warnings:

  - You are about to drop the `musryif` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "izin" DROP CONSTRAINT "izin_id_musyrif_fkey";

-- DropForeignKey
ALTER TABLE "mahasantri" DROP CONSTRAINT "mahasantri_id_musyrif_fkey";

-- DropForeignKey
ALTER TABLE "musryif" DROP CONSTRAINT "musryif_id_pengguna_fkey";

-- DropTable
DROP TABLE "musryif";

-- CreateTable
CREATE TABLE "musyrif" (
    "id_musyrif" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "no_telepon" TEXT NOT NULL,

    CONSTRAINT "musyrif_pkey" PRIMARY KEY ("id_musyrif")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id_log" TEXT NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "modul" VARCHAR(100) NOT NULL,
    "aktivitas" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id_log")
);

-- CreateIndex
CREATE UNIQUE INDEX "musyrif_id_pengguna_key" ON "musyrif"("id_pengguna");

-- CreateIndex
CREATE INDEX "activity_logs_role_created_at_idx" ON "activity_logs"("role", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_username_idx" ON "activity_logs"("username");

-- AddForeignKey
ALTER TABLE "musyrif" ADD CONSTRAINT "musyrif_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasantri" ADD CONSTRAINT "mahasantri_id_musyrif_fkey" FOREIGN KEY ("id_musyrif") REFERENCES "musyrif"("id_musyrif") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin" ADD CONSTRAINT "izin_id_musyrif_fkey" FOREIGN KEY ("id_musyrif") REFERENCES "musyrif"("id_musyrif") ON DELETE RESTRICT ON UPDATE CASCADE;
