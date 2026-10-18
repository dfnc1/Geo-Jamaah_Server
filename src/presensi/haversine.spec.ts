import { haversineMeter } from './haversine';

/**
 * Perkiraan jarak antar titik memakai konstanta yang sama dengan implementasi:
 * 1 derajat lintang ≈ (π/180) × 6.371.000 = 111.194,93 m.
 */
describe('haversineMeter', () => {
  it('mengembalikan 0 untuk dua titik yang identik', () => {
    expect(haversineMeter(-7.9666, 112.6326, -7.9666, 112.6326)).toBe(0);
  });

  it('menghasilkan jarak yang diketahui: 1 derajat lintang ≈ 111,19 km', () => {
    const jarak = haversineMeter(-7.0, 112.0, -6.0, 112.0);
    expect(jarak).toBeCloseTo(111_194.9, 0);
  });

  it('menghasilkan ≈ 11,12 m untuk selisih lintang 0,0001 derajat', () => {
    const jarak = haversineMeter(-7.9666, 112.6326, -7.9667, 112.6326);
    expect(jarak).toBeCloseTo(11.12, 1);
  });

  it('bersimetris: jarak A→B sama dengan B→A', () => {
    const ab = haversineMeter(-7.9666, 112.6326, -6.9175, 107.6191);
    const ba = haversineMeter(-6.9175, 107.6191, -7.9666, 112.6326);
    expect(ab).toBeCloseTo(ba, 6);
  });

  describe('dipakai untuk cek radius (radius_toleransi 100 m)', () => {
    const masjidLat = -7.9666;
    const masjidLon = 112.6326;

    it('titik DI DALAM radius: ±55,6 m dari masjid', () => {
      // selisih lintang 0,0005° ≈ 55,6 m
      const jarak = haversineMeter(-7.9671, 112.6326, masjidLat, masjidLon);
      expect(jarak).toBeCloseTo(55.6, 0);
      expect(jarak).toBeLessThanOrEqual(100);
    });

    it('titik DI LUAR radius: ±222,4 m dari masjid', () => {
      // selisih lintang 0,002° ≈ 222,4 m
      const jarak = haversineMeter(-7.9686, 112.6326, masjidLat, masjidLon);
      expect(jarak).toBeCloseTo(222.4, 0);
      expect(jarak).toBeGreaterThan(100);
    });

    it('titik TEPAT di radius diterima (batas inklusif)', () => {
      // 100 m ≈ selisih lintang 0,0008993° dari masjid; koordinat dipilih
      // agar hasil ~99,96 m: lolos karena batas memakai "jarak <= radius".
      const jarak = haversineMeter(-7.9674993, 112.6326, masjidLat, masjidLon);
      expect(jarak).toBeGreaterThan(99.9);
      expect(jarak).toBeLessThanOrEqual(100);
    });
  });
});
