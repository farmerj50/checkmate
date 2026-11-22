import fs from 'node:fs';
import path from 'node:path';

export function ownedUploadPath(url: unknown, ownedUrls: string[], uid: string, kind: 'photo' | 'video', uploadsDir = path.resolve(process.cwd(), 'uploads')): string | null {
  if (typeof url !== 'string' || !ownedUrls.includes(url)) return null;
  // Inspect the raw path before URL parsing can normalize traversal segments.
  const match = /^https?:\/\/[^/?#]+\/uploads\/(videos\/)?([A-Za-z0-9_-]+\.(?:jpg|mp4|webm|mov|avi))$/.exec(url);
  if (!match || Boolean(match[1]) !== (kind === 'video')) return null;
  const owner = uid.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = match[2];
  if (!filename.startsWith(kind === 'photo' ? `${owner}_` : `video_${owner}_`)) return null;
  const directory = path.resolve(uploadsDir, ...(kind === 'video' ? ['videos'] : []));
  const target = path.resolve(directory, filename);
  if (path.dirname(target) !== directory) return null;
  if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink() ||
      path.dirname(fs.realpathSync(target)) !== fs.realpathSync(directory))) return null;
  return target;
}
