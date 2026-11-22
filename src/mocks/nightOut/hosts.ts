import type { NightOutHost } from '../../services/nightOut/types';

export const MOCK_NIGHT_OUT_HOSTS: NightOutHost[] = [
  { id: 'host-luna-lounge', firstName: 'Luna Lounge', profilePictures: ['https://i.pravatar.cc/150?img=68'], isVerified: true },
  { id: 'host-marcus', firstName: 'Marcus', profilePictures: ['https://i.pravatar.cc/150?img=14'], isVerified: false },
  { id: 'host-downtown-comedy', firstName: 'Downtown Comedy Club', profilePictures: ['https://i.pravatar.cc/150?img=51'], isVerified: true },
];

export function nightOutHostById(id: string): NightOutHost {
  return MOCK_NIGHT_OUT_HOSTS.find((h) => h.id === id) ?? MOCK_NIGHT_OUT_HOSTS[0];
}
