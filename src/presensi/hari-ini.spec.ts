import { susunHariIni, tentukanStatusHariIni } from './hari-ini';

describe('tentukanStatusHariIni', () => {
  const baris = [
    { id_jadwal: 'j1', status_presensi: 'Hadir' },
    { id_jadwal: 'j2', status_presensi: 'Tidak_Hadir' },
    { id_jadwal: 'j3', status_presensi: 'Izin' },
    { id_jadwal: 'j4', status_presensi: 'Manual' },
    { id_jadwal: 'j5', status_presensi: 'UNKNOWN_VALUE' },
  ];

  it('mengembalikan Hadir jika ada baris dengan status Hadir', () => {
    expect(tentukanStatusHariIni('j1', baris)).toBe('Hadir');
  });

  it('mengembalikan Tidak_Hadir jika ada baris dengan status Tidak_Hadir', () => {
    expect(tentukanStatusHariIni('j2', baris)).toBe('Tidak_Hadir');
  });

  it('mengembalikan Izin jika ada baris dengan status Izin', () => {
    expect(tentukanStatusHariIni('j3', baris)).toBe('Izin');
  });

  it('mengembalikan Manual jika ada baris dengan status Manual', () => {
    expect(tentukanStatusHariIni('j4', baris)).toBe('Manual');
  });

  it('mengembalikan Belum jika tidak ada baris untuk jadwal itu', () => {
    expect(tentukanStatusHariIni('j-tidak-ada', baris)).toBe('Belum');
  });

  it('mengembalikan Belum untuk nilai status tidak dikenal (defensif)', () => {
    expect(tentukanStatusHariIni('j5', baris)).toBe('Belum');
  });

  it('mengembalikan Belum jika daftar baris kosong', () => {
    expect(tentukanStatusHariIni('j1', [])).toBe('Belum');
  });
});

describe('susunHariIni – sedang_dalam_window', () => {
  const jadwal = [
    {
      id_jadwal: 'j1',
      nama_sholat: 'Subuh',
      waktu_azan: '04:30',
      waktu_iqamah: '04:35',
      waktu_mulai_presensi: '04:20',
      waktu_akhir_presensi: '05:00',
    },
    {
      id_jadwal: 'j2',
      nama_sholat: 'Dzuhur',
      waktu_azan: '12:00',
      waktu_iqamah: '12:10',
      waktu_mulai_presensi: '11:50',
      waktu_akhir_presensi: '12:30',
    },
  ];

  it('sedang_dalam_window true jika waktu persis di awal window (inklusif)', () => {
    const hasil = susunHariIni(jadwal, [], '04:20');
    expect(hasil[0].sedang_dalam_window).toBe(true);
  });

  it('sedang_dalam_window true jika waktu persis di akhir window (inklusif)', () => {
    const hasil = susunHariIni(jadwal, [], '05:00');
    expect(hasil[0].sedang_dalam_window).toBe(true);
  });

  it('sedang_dalam_window true jika waktu di tengah window', () => {
    const hasil = susunHariIni(jadwal, [], '04:40');
    expect(hasil[0].sedang_dalam_window).toBe(true);
  });

  it('sedang_dalam_window false jika waktu sebelum window dimulai', () => {
    const hasil = susunHariIni(jadwal, [], '04:19');
    expect(hasil[0].sedang_dalam_window).toBe(false);
  });

  it('sedang_dalam_window false jika waktu setelah window berakhir', () => {
    const hasil = susunHariIni(jadwal, [], '05:01');
    expect(hasil[0].sedang_dalam_window).toBe(false);
  });

  it('flag dihitung independent per jadwal (satu window aktif, satu tidak)', () => {
    // jam 12:00: Subuh sudah tutup, Dzuhur baru mulai
    const hasil = susunHariIni(jadwal, [], '12:00');
    expect(hasil[0].sedang_dalam_window).toBe(false); // Subuh
    expect(hasil[1].sedang_dalam_window).toBe(true);  // Dzuhur
  });

  it('menggabungkan status dan window dengan benar dalam satu panggilan', () => {
    const baris = [{ id_jadwal: 'j1', status_presensi: 'Hadir' }];
    const hasil = susunHariIni(jadwal, baris, '12:05');
    expect(hasil[0].status).toBe('Hadir');
    expect(hasil[0].sedang_dalam_window).toBe(false);
    expect(hasil[1].status).toBe('Belum');
    expect(hasil[1].sedang_dalam_window).toBe(true);
  });

  it('daftar slot mengikuti urutan jadwal yang diberikan', () => {
    const hasil = susunHariIni(jadwal, [], '08:00');
    expect(hasil.map((s) => s.id_jadwal)).toEqual(['j1', 'j2']);
  });
});
