/** Radius bumi rata-rata dalam meter (WGS-84, dibulatkan). */
const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degree: number): number => (degree * Math.PI) / 180;

/**
 * Jarak Haversine antara dua titik koordinat, dalam meter.
 *
 * Fungsi murni (tanpa IO dan tanpa waktu server) supaya mudah diuji unit
 * test. Dipakai PresensiService untuk membandingkan posisi user dengan
 * lokasi masjid (BR-01); perhitungan selalu di server, frontend hanya
 * mengirim koordinat mentah.
 *
 * @param lat1 lintang titik pertama (-90..90)
 * @param lon1 bujur titik pertama (-180..180)
 * @param lat2 lintang titik kedua (-90..90)
 * @param lon2 bujur titik kedua (-180..180)
 * @returns jarak permukaan bumi dalam meter
 */
export function haversineMeter(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}
