import { Logger } from '@nestjs/common';
import { parseThrottleLimit } from './throttle-limit';

describe('parseThrottleLimit', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('env tidak diset -> fallback tanpa warn', () => {
    expect(parseThrottleLimit(undefined, 600, 'X_LIMIT')).toBe(600);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('env kosong/spasi -> fallback tanpa warn (dianggap tidak diset)', () => {
    expect(parseThrottleLimit('', 600, 'X_LIMIT')).toBe(600);
    expect(parseThrottleLimit('   ', 600, 'X_LIMIT')).toBe(600);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('bilangan bulat valid -> dipakai, dengan spasi di sekelilingnya', () => {
    expect(parseThrottleLimit('20', 600, 'X_LIMIT')).toBe(20);
    expect(parseThrottleLimit(' 30 ', 600, 'X_LIMIT')).toBe(30);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([['abc'], ['0'], ['-5'], ['12.5'], ['1e3'], ['20x']])(
    'nilai tidak valid "%s" -> fallback + Logger.warn',
    (raw) => {
      expect(parseThrottleLimit(raw, 600, 'X_LIMIT')).toBe(600);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('X_LIMIT'));
    },
  );
});
