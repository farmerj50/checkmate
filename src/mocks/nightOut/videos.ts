/**
 * Own copy of the real, already-committed sample clips under backend/uploads/videos/
 * (same files src/mocks/social/videos.ts points at) — duplicated rather than imported
 * cross-vertical so Night Out's mocks can be deleted independently of Social's later.
 */
export const NIGHT_OUT_SAMPLE_VIDEOS = [
  '/uploads/videos/video_demo_user_1776097923313.webm',
  '/uploads/videos/video_demo_user_1777988956951.mov',
  '/uploads/videos/video_demo_user_1777988964855.mov',
  '/uploads/videos/video_demo_user_1777991542801.mov',
  '/uploads/videos/video_demo_user_1777992302650.mov',
  '/uploads/videos/video_demo_user_1777993412935.mov',
];

/** mock-only: used by MockNightOutService.createEvent to stand in for a real upload. */
export function pickSampleVideo(seed: number): string {
  return NIGHT_OUT_SAMPLE_VIDEOS[seed % NIGHT_OUT_SAMPLE_VIDEOS.length];
}
