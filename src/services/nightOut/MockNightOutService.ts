import { MOCK_NIGHT_OUT_EVENTS, MOCK_ME_CITY } from '../../mocks/nightOut/events';
import { pickSampleVideo } from '../../mocks/nightOut/videos';
import type { NightOutService } from './NightOutService';
import type {
  CreateNightOutEventInput,
  NightOutEvent,
  NightOutTab,
  Page,
} from './types';

const PAGE_SIZE = 12;
const NETWORK_DELAY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** "Me" for the purposes of this mock session — arbitrary, just needs to be stable. */
const MOCK_ME_ID = 'me';

const CATEGORY_TABS = new Set(['FOOD_DRINKS', 'LIVE_MUSIC', 'PARTIES', 'COMEDY', 'EVENTS', 'DATE_NIGHT']);

function isWithinNextHours(iso: string, hours: number): boolean {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return t >= now && t <= now + hours * 3600_000;
}

function isThisWeekend(iso: string): boolean {
  const now = new Date();
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilSaturday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 2); // through end of Sunday
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/**
 * In-memory implementation of NightOutService, seeded from src/mocks/nightOut/**.
 * Frontend-only — there is no real Night Out backend yet, so every filter here is a
 * deliberately simple stand-in, not production logic. See plan §7 for what's expected
 * to change once a real contract exists.
 */
export class MockNightOutService implements NightOutService {
  private events: NightOutEvent[] = clone(MOCK_NIGHT_OUT_EVENTS);
  private nextEventSeed = this.events.length;

  async listEvents(tab: NightOutTab, cursor?: string): Promise<Page<NightOutEvent>> {
    let filtered: NightOutEvent[];
    if (tab === 'TONIGHT') {
      filtered = this.events.filter((e) => isWithinNextHours(e.startTime, 18));
    } else if (tab === 'THIS_WEEKEND') {
      filtered = this.events.filter((e) => isThisWeekend(e.startTime));
    } else if (tab === 'NEARBY') {
      // NEARBY is a fake city-string filter, not real geospatial distance — there's
      // no geolocation/maps integration in this slice. See plan §7.
      filtered = this.events.filter((e) => e.city === MOCK_ME_CITY);
    } else if (CATEGORY_TABS.has(tab)) {
      filtered = this.events.filter((e) => e.category === tab);
    } else {
      filtered = this.events;
    }
    const sorted = [...filtered].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return delay(paginate(sorted, cursor));
  }

  async getEvent(eventId: string): Promise<NightOutEvent | null> {
    return delay(this.events.find((e) => e.id === eventId) ?? null);
  }

  async getHostEvents(hostId: string, cursor?: string): Promise<Page<NightOutEvent>> {
    const sorted = this.events
      .filter((e) => e.hostId === hostId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return delay(paginate(sorted, cursor));
  }

  async createEvent(input: CreateNightOutEventInput): Promise<NightOutEvent> {
    // mock-only: the real file the user picked/recorded is never persisted anywhere —
    // there's no upload endpoint for event media yet, so a stock sample clip stands in
    // for it. Do not let this look like a real upload succeeded; see plan §7.
    const seed = this.nextEventSeed++;
    const event: NightOutEvent = {
      id: `night-out-created-${Date.now()}`,
      hostId: MOCK_ME_ID,
      host: { id: MOCK_ME_ID, firstName: 'You', profilePictures: [], isVerified: false },
      venueId: null,
      title: input.title,
      description: input.description,
      venueName: input.venueName,
      address: input.address,
      city: input.city,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      category: input.category,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      coverPrice: input.coverPrice ?? null,
      ticketUrl: input.ticketUrl ?? null,
      videoUrl: pickSampleVideo(seed),
      thumbnailUrl: null,
      ageRestriction: input.ageRestriction,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      isSaved: false,
      saveCount: 0,
    };
    this.events = [event, ...this.events];
    return delay(event);
  }

  async saveEvent(eventId: string): Promise<NightOutEvent> {
    const event = this.findMutableEvent(eventId);
    if (!event.isSaved) {
      event.isSaved = true;
      event.saveCount += 1;
    }
    return delay(event);
  }

  async unsaveEvent(eventId: string): Promise<NightOutEvent> {
    const event = this.findMutableEvent(eventId);
    if (event.isSaved) {
      event.isSaved = false;
      event.saveCount = Math.max(0, event.saveCount - 1);
    }
    return delay(event);
  }

  async report(): Promise<void> {
    return delay(undefined);
  }

  private findMutableEvent(eventId: string): NightOutEvent {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) throw new Error(`Mock night-out event not found: ${eventId}`);
    return event;
  }
}

function paginate<T extends { id: string }>(items: T[], cursor?: string): Page<T> {
  const startIndex = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0;
  const page = items.slice(startIndex, startIndex + PAGE_SIZE);
  const nextCursor = items.length > startIndex + PAGE_SIZE ? page[page.length - 1]?.id ?? null : null;
  return { items: page, nextCursor };
}
