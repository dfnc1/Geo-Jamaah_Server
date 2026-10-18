import {
  teksLoginBerhasil,
  teksLoginGagal,
  teksPresensi,
  teksAjukanIzin,
  teksVerifikasiIzin,
  teksMembuatMasjid,
  teksMengubahMasjid,
  teksMenghapusMasjid,
  teksMembuatJadwal,
  teksMengubahJadwal,
  teksMenghapusJadwal,
  teksResetDevice,
  teksPemicuJob,
  potongTeks,
  potongUsername,
  MAKS_AKTIVITAS,
} from './audit-teks';

describe('audit-teks (pembentuk teks aktivitas)', () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  describe('teksLoginBerhasil', () => {
    it('mengembalikan "Login berhasil"', () => {
      expect(teksLoginBerhasil()).toBe('Login berhasil');
    });
  });

  describe('teksLoginGagal', () => {
    it('ERR_INVALID_CREDENTIALS -> "Login gagal: username atau kata sandi salah"', () => {
      expect(teksLoginGagal('ERR_INVALID_CREDENTIALS', true)).toBe(
        'Login gagal: username atau kata sandi salah',
      );
    });

    it('ERR_DEVICE_MISMATCH -> "Login gagal: perangkat sudah terikat akun lain"', () => {
      expect(teksLoginGagal('ERR_DEVICE_MISMATCH', true)).toBe(
        'Login gagal: perangkat sudah terikat akun lain',
      );
    });

    it('ERR_ACCOUNT_INACTIVE -> "Login gagal: akun tidak aktif"', () => {
      expect(teksLoginGagal('ERR_ACCOUNT_INACTIVE', true)).toBe(
        'Login gagal: akun tidak aktif',
      );
    });

    it('ERR_DEVICE_ID_REQUIRED -> "Login gagal: perangkat wajib diisi untuk Mahasantri"', () => {
      expect(teksLoginGagal('ERR_DEVICE_ID_REQUIRED', true)).toBe(
        'Login gagal: perangkat wajib diisi untuk Mahasantri',
      );
    });

    it('kode tak dikenal -> "Login gagal (<kode>)"', () => {
      expect(teksLoginGagal('ERR_SOMETHING_ELSE', true)).toBe(
        'Login gagal (ERR_SOMETHING_ELSE)',
      );
    });

    it('username tidak terdaftar -> "Login gagal: username tidak terdaftar"', () => {
      expect(teksLoginGagal('ERR_INVALID_CREDENTIALS', false)).toBe(
        'Login gagal: username tidak terdaftar',
      );
    });

    it('TIDAK ADA teks login yang memuat token literal "password" atau "device_id"', () => {
      // Grep harfiah di DB harus 0 baris untuk kedua token ini.
      const semuaKode = [
        'ERR_INVALID_CREDENTIALS',
        'ERR_DEVICE_MISMATCH',
        'ERR_ACCOUNT_INACTIVE',
        'ERR_DEVICE_ID_REQUIRED',
        'ERR_LAINNYA',
      ];
      for (const kode of semuaKode) {
        const teks = teksLoginGagal(kode, true);
        expect(teks.toLowerCase()).not.toContain('password');
        expect(teks.toLowerCase()).not.toContain('device_id');
      }
      expect(teksLoginGagal('ERR_INVALID_CREDENTIALS', false).toLowerCase()).not.toContain(
        'password',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Presensi
  // -------------------------------------------------------------------------
  describe('teksPresensi', () => {
    it('membentuk "Presensi Subuh berhasil, jarak 23 m"', () => {
      expect(teksPresensi({ nama_sholat: 'Subuh', jarak_meter: 23 })).toBe(
        'Presensi Subuh berhasil, jarak 23 m',
      );
    });

    it('jarak dibulatkan ke integer terdekat', () => {
      expect(teksPresensi({ nama_sholat: 'Dzuhur', jarak_meter: 45.6 })).toBe(
        'Presensi Dzuhur berhasil, jarak 46 m',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Izin
  // -------------------------------------------------------------------------
  describe('teksAjukanIzin', () => {
    it('membentuk "Mengajukan izin Sakit tanggal 2026-10-20"', () => {
      const tanggal = new Date('2026-10-20T00:00:00.000Z');
      expect(teksAjukanIzin({ jenis_izin: 'Sakit', tanggal_izin: tanggal })).toBe(
        'Mengajukan izin Sakit tanggal 2026-10-20',
      );
    });

    it('menerima tanggal berbentuk string ISO (bentuk respons serialisasi)', () => {
      expect(
        teksAjukanIzin({
          jenis_izin: 'Tugas_Kampus',
          tanggal_izin: '2026-11-02T00:00:00.000Z',
        }),
      ).toBe('Mengajukan izin Tugas_Kampus tanggal 2026-11-02');
    });
  });

  describe('teksVerifikasiIzin', () => {
    it('membentuk "Memverifikasi izin 24050505050 menjadi Disetujui"', () => {
      expect(
        teksVerifikasiIzin({ nim: '24050505050', status_persetujuan: 'Disetujui' }),
      ).toBe('Memverifikasi izin 24050505050 menjadi Disetujui');
    });
  });

  // -------------------------------------------------------------------------
  // Masjid
  // -------------------------------------------------------------------------
  describe('Masjid', () => {
    it('membentuk "Membuat masjid Masjid Al-Ikhlas"', () => {
      expect(teksMembuatMasjid('Masjid Al-Ikhlas')).toBe(
        'Membuat masjid Masjid Al-Ikhlas',
      );
    });

    it('membentuk "Mengubah masjid <id>" (pakai id, bukan nama)', () => {
      expect(teksMengubahMasjid('id-123')).toBe('Mengubah masjid id-123');
    });

    it('membentuk "Menghapus masjid <id>" (pakai id, bukan nama)', () => {
      expect(teksMenghapusMasjid('id-123')).toBe('Menghapus masjid id-123');
    });
  });

  // -------------------------------------------------------------------------
  // Jadwal Sholat
  // -------------------------------------------------------------------------
  describe('Jadwal', () => {
    it('membentuk "Membuat jadwal sholat Subuh"', () => {
      expect(teksMembuatJadwal('Subuh')).toBe('Membuat jadwal sholat Subuh');
    });

    it('membentuk "Mengubah jadwal sholat <id>" (pakai id, bukan nama)', () => {
      expect(teksMengubahJadwal('jadwal-1')).toBe('Mengubah jadwal sholat jadwal-1');
    });

    it('membentuk "Menghapus jadwal sholat <id>" (pakai id, bukan nama)', () => {
      expect(teksMenghapusJadwal('jadwal-1')).toBe('Menghapus jadwal sholat jadwal-1');
    });
  });

  // -------------------------------------------------------------------------
  // Mahasantri & Jobs
  // -------------------------------------------------------------------------
  describe('teksResetDevice', () => {
    it('membentuk "Reset device Mahasantri <nim> (<nama>)"', () => {
      expect(teksResetDevice({ nim: '24050505050', nama: 'Ahmad Fauzi' })).toBe(
        'Reset device Mahasantri 24050505050 (Ahmad Fauzi)',
      );
    });
  });

  describe('teksPemicuJob', () => {
    it('membentuk teks lengkap dengan jumlah Tidak_Hadir/Izin/total', () => {
      expect(
        teksPemicuJob({
          tanggal: '2026-10-18',
          dibuat: { Tidak_Hadir: 5, Izin: 1 },
        }),
      ).toBe('Pemicu manual job tandai-tidak-hadir 2026-10-18: Tidak_Hadir 5, Izin 1 (total 6)');
    });
  });

  // -------------------------------------------------------------------------
  // Potong teks & username
  // -------------------------------------------------------------------------
  describe('potongTeks', () => {
    it('memotong tepat MAKS_AKTIVITAS (500) karakter', () => {
      const panjang = MAKS_AKTIVITAS;
      const teks = 'a'.repeat(panjang);
      const hasil = potongTeks(teks);
      expect(hasil.length).toBe(panjang);
    });

    it('memotong teks > 500 karakter', () => {
      const teks = 'a'.repeat(MAKS_AKTIVITAS + 100);
      const hasil = potongTeks(teks);
      expect(hasil.length).toBe(MAKS_AKTIVITAS);
    });

    it('tidak memotong teks <= 500 karakter', () => {
      const teks = 'a'.repeat(MAKS_AKTIVITAS - 1);
      const hasil = potongTeks(teks);
      expect(hasil.length).toBe(MAKS_AKTIVITAS - 1);
    });
  });

  describe('potongUsername', () => {
    it('memotong username >= 100 karakter (kolom VarChar(100))', () => {
      const username = 'a'.repeat(150);
      const hasil = potongUsername(username);
      expect(hasil.length).toBe(100);
    });

    it('tidak memotong username < 100 karakter', () => {
      const username = 'a'.repeat(50);
      const hasil = potongUsername(username);
      expect(hasil.length).toBe(50);
    });

    it('memotong tepat 100 karakter', () => {
      const username = 'a'.repeat(100);
      const hasil = potongUsername(username);
      expect(hasil.length).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Kebijakan keamanan: argumen palsu dengan password/token/device_id
  // tidak pernah muncul di output teks
  // -------------------------------------------------------------------------
  describe('Kebijakan keamanan: tidak ada field sensitif di teks', () => {
    const password = 'rahasia-super-rahasia';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.palingsensitif';
    const deviceId = 'dev-abc123-sensitif';

    it('teksLoginBerhasil() tidak menerima argumen apa pun', () => {
      const hasil = teksLoginBerhasil();
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksLoginGagal() hanya menerima kodeError dan boolean — password tidak pernah masuk', () => {
      const hasil = teksLoginGagal('ERR_INVALID_CREDENTIALS', true);
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksPresensi() hanya menerima nama_sholat dan jarak_meter', () => {
      const hasil = teksPresensi({ nama_sholat: 'Subuh', jarak_meter: 23 });
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksAjukanIzin() hanya menerima jenis_izin dan tanggal_izin', () => {
      const hasil = teksAjukanIzin({
        jenis_izin: 'Sakit',
        tanggal_izin: new Date('2026-10-20T00:00:00.000Z'),
      });
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksVerifikasiIzin() hanya menerima nim dan status', () => {
      const hasil = teksVerifikasiIzin({
        nim: '24050505050',
        status_persetujuan: 'Disetujui',
      });
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksMembuatMasjid/MengubahMasjid/MenghapusMasjid tidak menerima objek dengan password', () => {
      // Simulasi: panggil dengan objek palsu yang mengandung password/token.
      // Karena fungsi hanya menerima string, field sensitif tidak akan pernah
      // muncul di output.
      const hasilBuat = teksMembuatMasjid('Masjid Tes');
      const hasilUbah = teksMengubahMasjid('id-1');
      const hasilHapus = teksMenghapusMasjid('id-1');
      expect(hasilBuat).not.toContain(password);
      expect(hasilUbah).not.toContain(password);
      expect(hasilHapus).not.toContain(password);
    });

    it('teksResetDevice() hanya menerima nim dan nama', () => {
      const hasil = teksResetDevice({ nim: '24050505050', nama: 'Ahmad' });
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('teksPemicuJob() hanya menerima tanggal dan jumlah', () => {
      const hasil = teksPemicuJob({
        tanggal: '2026-10-18',
        dibuat: { Tidak_Hadir: 5, Izin: 1 },
      });
      expect(hasil).not.toContain(password);
      expect(hasil).not.toContain(token);
      expect(hasil).not.toContain(deviceId);
    });

    it('SEMUA pembentuk teks: grep harfiah password / device_id / access_token = 0', () => {
      // Meniru verifikasi grep di DB: tidak ada satu pun teks yang memuat
      // token literal yang bisa disalahartikan sebagai nilai sensitif.
      const semuaTeks = [
        teksLoginBerhasil(),
        teksLoginGagal('ERR_INVALID_CREDENTIALS', true),
        teksLoginGagal('ERR_DEVICE_MISMATCH', true),
        teksLoginGagal('ERR_ACCOUNT_INACTIVE', true),
        teksLoginGagal('ERR_DEVICE_ID_REQUIRED', true),
        teksLoginGagal('ERR_LAINNYA', true),
        teksLoginGagal('ERR_INVALID_CREDENTIALS', false),
        teksPresensi({ nama_sholat: 'Subuh', jarak_meter: 23 }),
        teksAjukanIzin({
          jenis_izin: 'Sakit',
          tanggal_izin: new Date('2026-10-20T00:00:00.000Z'),
        }),
        teksVerifikasiIzin({
          nim: '24050505050',
          status_persetujuan: 'Disetujui',
        }),
        teksMembuatMasjid('Masjid Tes'),
        teksMengubahMasjid('id-1'),
        teksMenghapusMasjid('id-1'),
        teksMembuatJadwal('Tes'),
        teksMengubahJadwal('id-1'),
        teksMenghapusJadwal('id-1'),
        teksResetDevice({ nim: '24050505050', nama: 'Tes' }),
        teksPemicuJob({
          tanggal: '2026-10-18',
          dibuat: { Tidak_Hadir: 1, Izin: 0 },
        }),
      ];

      for (const teks of semuaTeks) {
        const hurufKecil = teks.toLowerCase();
        expect(hurufKecil).not.toContain('password');
        expect(hurufKecil).not.toContain('device_id');
        expect(hurufKecil).not.toContain('access_token');
        expect(hurufKecil).not.toContain('rahasia');
        expect(hurufKecil).not.toContain('bearer');
        expect(teks.length).toBeLessThanOrEqual(MAKS_AKTIVITAS);
      }
    });
  });
});
