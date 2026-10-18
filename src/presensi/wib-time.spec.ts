import {
  hhmmToMinutes,
  isWithinWindow,
  toWibDate,
  toWibHHmm,
} from './wib-time';

/**
 * Window presensi contoh (JadwalSholat Subuh): 04:15 - 05:10 (WIB).
 * Aturan: inklusif di kedua ujung (tepat di batas diterima).
 */
describe('isWithinWindow', () => {
  const mulai = '04:15';
  const akhir = '05:10';

  it('menerima waktu di dalam window', () => {
    expect(isWithinWindow('04:59', mulai, akhir)).toBe(true);
    expect(isWithinWindow('04:30', mulai, akhir)).toBe(true);
  });

  it('menerima tepat di waktu_mulai_presensi (batas inklusif)', () => {
    expect(isWithinWindow('04:15', mulai, akhir)).toBe(true);
  });

  it('menerima tepat di waktu_akhir_presensi (batas inklusif)', () => {
    expect(isWithinWindow('05:10', mulai, akhir)).toBe(true);
  });

  it('menolak 1 menit sebelum waktu_mulai_presensi', () => {
    expect(isWithinWindow('04:14', mulai, akhir)).toBe(false);
  });

  it('menolak 1 menit setelah waktu_akhir_presensi', () => {
    expect(isWithinWindow('05:11', mulai, akhir)).toBe(false);
  });

  it('menolak waktu yang jauh di luar window', () => {
    expect(isWithinWindow('12:00', mulai, akhir)).toBe(false);
    expect(isWithinWindow('00:00', mulai, akhir)).toBe(false);
  });
});

describe('hhmmToMinutes', () => {
  it('mengonversi HH:mm ke menit sejak tengah malam', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
    expect(hhmmToMinutes('04:15')).toBe(255);
    expect(hhmmToMinutes('23:59')).toBe(1439);
  });
});

describe('toWibHHmm', () => {
  it('menghitung jam WIB (UTC+7), bukan timezone proses', () => {
    // 2026-10-18 17:30 UTC = 2026-10-19 00:30 WIB
    expect(toWibHHmm(new Date('2026-10-18T17:30:00.000Z'))).toBe('00:30');
    // 2026-10-18 18:00 UTC = 2026-10-19 01:00 WIB
    expect(toWibHHmm(new Date('2026-10-18T18:00:00.000Z'))).toBe('01:00');
    // 2026-10-18 00:00 UTC = 2026-10-18 07:00 WIB
    expect(toWibHHmm(new Date('2026-10-18T00:00:00.000Z'))).toBe('07:00');
  });
});

describe('toWibDate', () => {
  it('mengambil tanggal WIB dalam format Date (untuk kolom @db.Date)', () => {
    // 17:30 UTC sudah lewat tengah malam WIB → tanggal bergeser besok
    const tanggal = toWibDate(new Date('2026-10-18T17:30:00.000Z'));
    expect(tanggal.toISOString()).toBe('2026-10-19T00:00:00.000Z');

    const pagi = toWibDate(new Date('2026-10-18T00:00:00.000Z'));
    expect(pagi.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });
});
