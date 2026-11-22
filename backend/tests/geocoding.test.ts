import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeLocation } from '../src/lib/geocoding';

describe('Geocoding response validation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('converts valid coordinates into finite numbers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ lat: '40.71', lon: '-74.01' }] }));
    expect(await geocodeLocation('Test city')).toEqual({ lat: 40.71, lng: -74.01 });
  });
  it.each([{}, [], [{ lat: 'NaN', lon: '1' }], [{ lat: '91', lon: '0' }], [{ lat: '1', lon: '181' }], [{ lat: '', lon: '0' }]])('ignores malformed coordinates: %j', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
    expect(await geocodeLocation('Test city')).toBeNull();
  });
});
