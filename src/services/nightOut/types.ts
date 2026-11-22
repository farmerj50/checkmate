export type NightOutCategory =
  | 'FOOD_DRINKS'
  | 'LIVE_MUSIC'
  | 'PARTIES'
  | 'COMEDY'
  | 'EVENTS'
  | 'DATE_NIGHT';

/** The first 3 are smart filters over time/location, not categories — see MockNightOutService.listEvents. */
export type NightOutTab = 'TONIGHT' | 'THIS_WEEKEND' | 'NEARBY' | NightOutCategory;

export type NightOutEventStatus = 'PUBLISHED' | 'CANCELLED' | 'PAST';
export type NightOutAgeRestriction = 'ALL_AGES' | 'EIGHTEEN_PLUS' | 'TWENTYONE_PLUS';

export interface NightOutHost {
  id: string;
  firstName: string;
  profilePictures: string[];
  isVerified: boolean;
}

export interface NightOutEvent {
  id: string;
  hostId: string;
  /** Denormalized host summary embedded on the event, same pattern as SocialPost.author. */
  host: NightOutHost;
  /** No real venue/business entity yet — reserved so a future backend can introduce one without an event-model rewrite. */
  venueId: string | null;
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  category: NightOutCategory;
  startTime: string; // ISO 8601
  endTime: string | null;
  coverPrice: number | null; // dollars; null = free/unlisted
  ticketUrl: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  ageRestriction: NightOutAgeRestriction;
  status: NightOutEventStatus;
  createdAt: string;
  /** Viewer-scoped — not in the original field spec, added to make "save" implementable client-side. */
  isSaved: boolean;
  saveCount: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateNightOutEventInput {
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  category: NightOutCategory;
  startTime: string;
  endTime?: string;
  coverPrice?: number;
  ticketUrl?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  ageRestriction: NightOutAgeRestriction;
}

export type NightOutReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'MISLEADING_INFO'
  | 'SAFETY_CONCERN'
  | 'SPAM'
  | 'OTHER';

export interface ReportNightOutEventInput {
  eventId: string;
  reason: NightOutReportReason;
  description?: string;
}
