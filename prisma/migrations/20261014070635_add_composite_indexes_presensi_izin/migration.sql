-- CreateIndex
CREATE INDEX "izin_nim_idx" ON "izin"("nim");

-- CreateIndex
CREATE INDEX "mahasantri_id_musyrif_idx" ON "mahasantri"("id_musyrif");

-- CreateIndex
CREATE INDEX "presensi_id_jadwal_tanggal_idx" ON "presensi"("id_jadwal", "tanggal");
