import type { NightOutEvent, NightOutCategory, NightOutAgeRestriction } from '../../services/nightOut/types';
import { nightOutHostById } from './hosts';
import { pickSampleVideo } from './videos';

/** "Me" for Nearby filtering purposes — arbitrary, just needs to be stable. See MockNightOutService. */
export const MOCK_ME_CITY = 'Austin, TX';

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

/** dayOffset: 0 = the upcoming Saturday, 1 = the upcoming Sunday. */
function upcomingWeekend(dayOffset: 0 | 1, hour: number): string {
  const now = new Date();
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + daysUntilSaturday + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(d: number, hour: number): string {
  const date = new Date(Date.now() + d * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

interface Seed {
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  category: NightOutCategory;
  ageRestriction: NightOutAgeRestriction;
  coverPrice: number | null;
  ticketUrl: string | null;
  startTime: string;
  endTime: string | null;
  hostId: string;
}

const SEEDS: Seed[] = [
  { title: 'Rooftop Happy Hour', description: 'Sunset views, half-off cocktails, and a DJ starting at 7.', venueName: 'Luna Lounge Rooftop', address: '400 Congress Ave', city: 'Austin, TX', category: 'FOOD_DRINKS', ageRestriction: 'TWENTYONE_PLUS', coverPrice: null, ticketUrl: null, startTime: hoursFromNow(3), endTime: hoursFromNow(6), hostId: 'host-luna-lounge' },
  { title: 'Indie Night Live', description: 'Three local indie acts, one stage, no cover before 9pm.', venueName: 'The Backyard Stage', address: '1200 E 6th St', city: 'Austin, TX', category: 'LIVE_MUSIC', ageRestriction: 'EIGHTEEN_PLUS', coverPrice: 10, ticketUrl: 'https://example.com/tickets/indie-night', startTime: hoursFromNow(5), endTime: hoursFromNow(9), hostId: 'host-marcus' },
  { title: 'Neon Rooftop Party', description: 'Blacklight, body paint, and a guest DJ set.', venueName: 'Skyline Rooftop', address: '88 East Ave', city: 'Austin, TX', category: 'PARTIES', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 20, ticketUrl: 'https://example.com/tickets/neon-rooftop', startTime: hoursFromNow(6), endTime: hoursFromNow(11), hostId: 'host-downtown-comedy' },
  { title: 'Stand-Up Showcase', description: 'Five comics, one mic, guaranteed laughs.', venueName: 'Downtown Comedy Club', address: '55 W 4th St', city: 'Denver, CO', category: 'COMEDY', ageRestriction: 'EIGHTEEN_PLUS', coverPrice: 15, ticketUrl: 'https://example.com/tickets/standup-showcase', startTime: hoursFromNow(4), endTime: hoursFromNow(6), hostId: 'host-luna-lounge' },
  { title: 'Art Walk & Wine', description: 'Gallery hop through downtown with a wine tasting at each stop.', venueName: 'Downtown Arts District', address: '210 Colorado St', city: 'Austin, TX', category: 'EVENTS', ageRestriction: 'ALL_AGES', coverPrice: null, ticketUrl: null, startTime: upcomingWeekend(0, 18), endTime: upcomingWeekend(0, 21), hostId: 'host-marcus' },
  { title: 'Candlelight Dinner Cruise', description: 'A slow sunset cruise with a three-course dinner for two.', venueName: 'Lady Bird Lake Boat Dock', address: '74 Trinity St', city: 'Austin, TX', category: 'DATE_NIGHT', ageRestriction: 'ALL_AGES', coverPrice: 85, ticketUrl: 'https://example.com/tickets/dinner-cruise', startTime: upcomingWeekend(0, 19), endTime: upcomingWeekend(0, 22), hostId: 'host-downtown-comedy' },
  { title: 'Sunday Brunch Cocktail Crawl', description: 'Three bars, one wristband, bottomless mimosas.', venueName: 'South Congress Strip', address: '1600 S Congress Ave', city: 'Austin, TX', category: 'FOOD_DRINKS', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 35, ticketUrl: 'https://example.com/tickets/brunch-crawl', startTime: upcomingWeekend(1, 12), endTime: upcomingWeekend(1, 15), hostId: 'host-luna-lounge' },
  { title: 'Jazz Trio Sessions', description: 'Late-night jazz in an intimate speakeasy setting.', venueName: 'The Hidden Room', address: '90 Larimer St', city: 'Denver, CO', category: 'LIVE_MUSIC', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 12, ticketUrl: null, startTime: upcomingWeekend(0, 21), endTime: null, hostId: 'host-marcus' },
  { title: 'Warehouse Block Party', description: 'Multi-room warehouse party with three DJs and a food truck lineup.', venueName: 'The Foundry Warehouse', address: '3200 Guadalupe St', city: 'Austin, TX', category: 'PARTIES', ageRestriction: 'EIGHTEEN_PLUS', coverPrice: 25, ticketUrl: 'https://example.com/tickets/warehouse-party', startTime: daysFromNow(10, 20), endTime: null, hostId: 'host-downtown-comedy' },
  { title: 'Open Mic Comedy Night', description: 'Sign up at the door, 5 minutes each, no cover.', venueName: 'The Punch Line Room', address: '712 W 6th St', city: 'Austin, TX', category: 'COMEDY', ageRestriction: 'EIGHTEEN_PLUS', coverPrice: null, ticketUrl: null, startTime: daysFromNow(12, 20), endTime: null, hostId: 'host-luna-lounge' },
  { title: 'Pop-Up Night Market', description: 'Local vendors, live music, and food trucks under string lights.', venueName: 'Zilker Park East Lawn', address: '2100 Barton Springs Rd', city: 'Austin, TX', category: 'EVENTS', ageRestriction: 'ALL_AGES', coverPrice: null, ticketUrl: null, startTime: daysFromNow(14, 17), endTime: daysFromNow(14, 22), hostId: 'host-marcus' },
  { title: 'Sunset Wine Tasting for Two', description: 'A guided tasting flight on a rooftop patio at golden hour.', venueName: 'Vine & Vista', address: '44 Larimer Sq', city: 'Denver, CO', category: 'DATE_NIGHT', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 60, ticketUrl: 'https://example.com/tickets/wine-tasting', startTime: daysFromNow(16, 18), endTime: daysFromNow(16, 20), hostId: 'host-downtown-comedy' },
  { title: 'Taco & Tequila Night', description: 'Unlimited tacos, a curated tequila flight, and mariachi at 8.', venueName: 'Casa Neon', address: '1500 E 7th St', city: 'Austin, TX', category: 'FOOD_DRINKS', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 30, ticketUrl: 'https://example.com/tickets/taco-tequila', startTime: daysFromNow(18, 19), endTime: null, hostId: 'host-luna-lounge' },
  { title: 'Acoustic Sessions', description: 'Stripped-down acoustic sets from three touring singer-songwriters.', venueName: 'The Parlor Room', address: '900 Red River St', city: 'Austin, TX', category: 'LIVE_MUSIC', ageRestriction: 'ALL_AGES', coverPrice: 18, ticketUrl: 'https://example.com/tickets/acoustic-sessions', startTime: daysFromNow(20, 19), endTime: null, hostId: 'host-marcus' },
  { title: 'Costume Rooftop Bash', description: 'Themed rooftop party with a costume contest and prizes.', venueName: 'Skyline Rooftop', address: '88 East Ave', city: 'Austin, TX', category: 'PARTIES', ageRestriction: 'TWENTYONE_PLUS', coverPrice: 22, ticketUrl: 'https://example.com/tickets/costume-bash', startTime: daysFromNow(22, 21), endTime: null, hostId: 'host-downtown-comedy' },
  { title: 'Headliner Comedy Showcase', description: 'A touring headliner plus two local openers.', venueName: 'Downtown Comedy Club', address: '55 W 4th St', city: 'Denver, CO', category: 'COMEDY', ageRestriction: 'EIGHTEEN_PLUS', coverPrice: 28, ticketUrl: 'https://example.com/tickets/headliner-showcase', startTime: daysFromNow(24, 20), endTime: null, hostId: 'host-luna-lounge' },
];

export const MOCK_NIGHT_OUT_EVENTS: NightOutEvent[] = SEEDS.map((seed, i) => ({
  id: `night-out-${i + 1}`,
  hostId: seed.hostId,
  host: nightOutHostById(seed.hostId),
  venueId: null,
  title: seed.title,
  description: seed.description,
  venueName: seed.venueName,
  address: seed.address,
  city: seed.city,
  latitude: null,
  longitude: null,
  category: seed.category,
  startTime: seed.startTime,
  endTime: seed.endTime,
  coverPrice: seed.coverPrice,
  ticketUrl: seed.ticketUrl,
  videoUrl: pickSampleVideo(i),
  thumbnailUrl: null,
  ageRestriction: seed.ageRestriction,
  status: 'PUBLISHED',
  createdAt: daysFromNow(-i, 9),
  isSaved: false,
  saveCount: (i * 7) % 40,
}));
