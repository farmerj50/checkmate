import type { User } from '../../types';

export type MockAuthor = Pick<User, 'id' | 'firstName' | 'profilePictures' | 'isVerified'>;

export const MOCK_AUTHORS: MockAuthor[] = [
  { id: 'user-ava', firstName: 'Ava', profilePictures: ['https://i.pravatar.cc/150?img=32'], isVerified: true },
  { id: 'user-jordan', firstName: 'Jordan', profilePictures: ['https://i.pravatar.cc/150?img=12'], isVerified: false },
  { id: 'user-mila', firstName: 'Mila', profilePictures: ['https://i.pravatar.cc/150?img=47'], isVerified: false },
  { id: 'user-devon', firstName: 'Devon', profilePictures: ['https://i.pravatar.cc/150?img=5'], isVerified: true },
  { id: 'user-priya', firstName: 'Priya', profilePictures: ['https://i.pravatar.cc/150?img=25'], isVerified: false },
];

export function authorById(id: string): MockAuthor {
  return MOCK_AUTHORS.find((a) => a.id === id) ?? MOCK_AUTHORS[0];
}
