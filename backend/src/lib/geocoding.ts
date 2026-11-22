import { z } from 'zod';

const ResultsSchema = z.array(z.object({
  lat: z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(-90).max(90)),
  lon: z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(-180).max(180)),
}));

/**
 * Geocode a free-text location string to lat/lng using OpenStreetMap Nominatim.
 * No API key required. Rate limit: 1 req/sec — we only call on profile save so this is fine.
 */
export async function geocodeLocation(
  location: string
): Promise<{ lat: number; lng: number } | null> {
  if (!location?.trim()) return null;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({ q: location, format: 'json', limit: '1' }).toString();

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Vipi-DatingApp/1.0',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) return null;

    const parsed = ResultsSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.length) return null;

    return {
      lat: parsed.data[0].lat,
      lng: parsed.data[0].lon,
    };
  } catch (err) {
    console.warn('Geocoding failed for:', location, err);
    return null;
  }
}
