import { activeUserIdentityWhere } from '../lib/access';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { ownedUploadPath } from '../lib/uploads';
import { ageInYears } from '../lib/profiles';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid), select: { id: true, isActive: true, dateOfBirth: true },
    });
    if (!user?.isActive || ageInYears(user.dateOfBirth) < 18) {
      return res.status(403).json({ error: 'An active adult profile is required' });
    }
    next();
  } catch { return res.status(503).json({ error: 'Uploads are temporarily unavailable' }); }
});

// ── Directories ───────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VIDEOS_DIR  = path.join(UPLOADS_DIR, 'videos');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR))  fs.mkdirSync(VIDEOS_DIR,  { recursive: true });

// ── Image upload (memory → sharp) ────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) { cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE')); return; }
    cb(null, true);
  },
});

// ── Video upload (disk, no transcoding) ──────────────────────────────────────
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (req: AuthenticatedRequest, file, cb) => {
      const uid = (req.user?.uid ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      // Determine file extension from mimetype
      let ext = 'mp4';
      if (file.mimetype === 'video/webm') ext = 'webm';
      else if (file.mimetype === 'video/quicktime') ext = 'mov';
      else if (file.mimetype === 'video/x-msvideo') ext = 'avi';
      cb(null, `video_${uid}_${randomUUID()}.${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 0, parts: 1 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(file.mimetype)) { cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE')); return; }
    cb(null, true);
  },
});

// ── POST /api/upload/photo ────────────────────────────────────────────────────
router.post('/photo', upload.single('photo'), async (req: AuthenticatedRequest, res) => {
  let outputPath: string | undefined;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid), select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.profilePictures.length >= 6) return res.status(400).json({ error: 'Maximum 6 photos allowed' });

    const filename = `${req.user!.uid.replace(/[^a-zA-Z0-9]/g, '_')}_${randomUUID()}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);
    outputPath = filepath;

    await sharp(req.file.buffer, { limitInputPixels: 25_000_000 })
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${filename}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { profilePictures: [...user.profilePictures, url] },
    });

    outputPath = undefined;
    res.json({ url });
  } catch (err: unknown) {
    if (outputPath) await fs.promises.unlink(outputPath).catch(() => {});
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── POST /api/upload/video — add to library, auto-set as active if first ──────
router.post('/video', videoUpload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid),
      select: { id: true, profileVideos: true, profileVideo: true },
    });
    if (!user) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedVideos = [...user.profileVideos, url];
    // Only set this new clip as the active feed video when there is no active video yet.
    const activeVideo = user.profileVideo && user.profileVideo.trim() !== ''
      ? user.profileVideo
      : url;

    await prisma.user.update({
      where: { id: user.id },
      data: { profileVideos: updatedVideos, profileVideo: activeVideo },
    });

    res.json({ url, profileVideos: updatedVideos, profileVideo: activeVideo });
  } catch (err: unknown) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Video upload error:', err);
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── DELETE /api/upload/video — remove specific video from library ─────────────
router.delete('/video', async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid),
      select: { id: true, profileVideos: true, profileVideo: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedVideos = user.profileVideos.filter((v) => v !== url);
    const filepath = ownedUploadPath(url, user.profileVideos, req.user!.uid, 'video', UPLOADS_DIR);
    if (!filepath) return res.status(403).json({ error: 'Video is not an owned upload' });
    // If the deleted video was the active one, pick the first remaining (or null)
    const activeVideo = user.profileVideo === url
      ? (updatedVideos[0] ?? null)
      : user.profileVideo;

    await prisma.user.update({
      where: { id: user.id },
      data: { profileVideos: updatedVideos, profileVideo: activeVideo },
    });

    // Delete file from disk
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch { /* ignore */ }

    res.json({ profileVideos: updatedVideos, profileVideo: activeVideo });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// ── PUT /api/upload/video/active — set which video shows in the feed ──────────
router.put('/video/active', async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid),
      select: { id: true, profileVideos: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.profileVideos.includes(url)) {
      return res.status(400).json({ error: 'Video not in your library' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { profileVideo: url } });
    res.json({ profileVideo: url });
  } catch (err) {
    console.error('Set active video error:', err);
    res.status(500).json({ error: 'Failed to set active video' });
  }
});

// ── DELETE /api/upload/photo ──────────────────────────────────────────────────
router.delete('/photo', async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid),
      select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = user.profilePictures.filter((p) => p !== url);
    const filepath = ownedUploadPath(url, user.profilePictures, req.user!.uid, 'photo', UPLOADS_DIR);
    if (!filepath) return res.status(403).json({ error: 'Photo is not an owned upload' });
    await prisma.user.update({ where: { id: user.id }, data: { profilePictures: updated } });

    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch { /* ignore */ }

    res.json({ profilePictures: updated });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ── PUT /api/upload/photos/reorder ───────────────────────────────────────────
router.put('/photos/reorder', async (req: AuthenticatedRequest, res) => {
  try {
    const { photos } = req.body as { photos: string[] };
    if (!Array.isArray(photos)) return res.status(400).json({ error: 'photos array required' });

    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid),
      select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const owned = new Set(user.profilePictures);
    if (photos.length !== owned.size || new Set(photos).size !== photos.length || photos.some(u => !owned.has(u))) {
      return res.status(400).json({ error: 'Provide each owned photo exactly once' });
    }
    const safe = photos;
    await prisma.user.update({ where: { id: user.id }, data: { profilePictures: safe } });
    res.json({ profilePictures: safe });
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// ── POST /api/upload/post-media — video media for social posts ────────────────
const postMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (req: AuthenticatedRequest, file, cb) => {
      const uid = (req.user?.uid ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      let ext = 'mp4';
      if (file.mimetype === 'video/webm') ext = 'webm';
      else if (file.mimetype === 'video/quicktime') ext = 'mov';
      cb(null, `post_${uid}_${randomUUID()}.${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype)) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'));
      return;
    }
    cb(null, true);
  },
});

router.post('/post-media', postMediaUpload.single('media'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;
    res.json({ url });
  } catch (err: unknown) {
    console.error('Post media upload error:', err);
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── POST /api/upload/video-message — video attached to a chat message ─────────
router.post('/video-message', videoUpload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;

    res.json({ url });
  } catch (err: unknown) {
    console.error('Video message upload error:', err);
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

const handleUploadError: express.ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
    return;
  }
  next(err);
};
router.use(handleUploadError);

export default router;
