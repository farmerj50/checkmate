import type {
  CreateNightOutEventInput,
  NightOutEvent,
  NightOutTab,
  Page,
  ReportNightOutEventInput,
} from './types';

export interface NightOutService {
  listEvents(tab: NightOutTab, cursor?: string): Promise<Page<NightOutEvent>>;
  getEvent(eventId: string): Promise<NightOutEvent | null>;
  getHostEvents(hostId: string, cursor?: string): Promise<Page<NightOutEvent>>;
  createEvent(input: CreateNightOutEventInput): Promise<NightOutEvent>;
  saveEvent(eventId: string): Promise<NightOutEvent>;
  unsaveEvent(eventId: string): Promise<NightOutEvent>;
  report(input: ReportNightOutEventInput): Promise<void>;
}
