interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

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
      headers: {
        'User-Agent': 'CheckMate-DatingApp/1.0',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) return null;

    const results: NominatimResult[] = await res.json();
    if (!results.length) return null;

    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
    };
  } catch (err) {
    console.warn('Geocoding failed for:', location, err);
    return null;
  }
}
