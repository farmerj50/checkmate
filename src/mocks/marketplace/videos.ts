/**
 * Own copy of the real, already-committed sample clips under backend/uploads/videos/
 * (same files src/mocks/social/videos.ts and src/mocks/nightOut/videos.ts point at) —
 * duplicated rather than imported cross-vertical so Marketplace's mocks can be deleted
 * independently of the others later.
 */
export const MARKETPLACE_SAMPLE_VIDEOS = [
  '/uploads/videos/video_demo_user_1776097923313.webm',
  '/uploads/videos/video_demo_user_1777988956951.mov',
  '/uploads/videos/video_demo_user_1777988964855.mov',
  '/uploads/videos/video_demo_user_1777991542801.mov',
  '/uploads/videos/video_demo_user_1777992302650.mov',
  '/uploads/videos/video_demo_user_1777993412935.mov',
];

/** mock-only: used by MockMarketplaceService.createListing to stand in for a real upload. */
export function pickSampleMarketplaceVideo(seed: number): string {
  return MARKETPLACE_SAMPLE_VIDEOS[seed % MARKETPLACE_SAMPLE_VIDEOS.length];
}
