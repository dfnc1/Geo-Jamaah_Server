import { Logger } from '@nestjs/common';

const logger = new Logger('Throttle');

/**
 * Parse nilai limit rate limit dari env (per 60 detik).
 *
 * Hanya bilangan bulat > 0 yang diterima. Nilai yang kosong dianggap
 * "tidak diset" (fallback tanpa suara); nilai tidak valid (teks, nol,
 * negatif, pecahan) memakai `fallback` plus Logger.warn supaya
 * konfigurasi rusak tidak mematikan rate limit dan mudah terlihat di log.
 */
export function parseThrottleLimit(
  raw: string | undefined,
  fallback: number,
  envName: string,
): number {
  if (raw !== undefined && raw.trim() !== '') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const value = Number(trimmed);
      if (value > 0) return value;
    }
    logger.warn(
      `Nilai env ${envName} tidak valid ("${raw}"), memakai default ${fallback}`,
    );
  }
  return fallback;
}
