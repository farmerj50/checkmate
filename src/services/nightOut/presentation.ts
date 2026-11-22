import type { NightOutCategory } from './types';

export const NIGHT_OUT_CATEGORY_LABELS: Record<NightOutCategory, string> = {
  FOOD_DRINKS: 'Food & Drinks',
  LIVE_MUSIC: 'Live Music',
  PARTIES: 'Parties',
  COMEDY: 'Comedy',
  EVENTS: 'Events',
  DATE_NIGHT: 'Date Night',
};

export function formatEventPrice(coverPrice: number | null): string {
  return coverPrice == null ? 'Free' : `$${coverPrice}`;
}
