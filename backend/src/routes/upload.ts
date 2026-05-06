import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// ── Directories ───────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VIDEOS_DIR  = path.join(UPLOADS_DIR, 'videos');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR))  fs.mkdirSync(VIDEOS_DIR,  { recursive: true });

// ── Image upload (memory → sharp) ────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) { cb(new Error('Only image files are allowed')); return; }
    cb(null, true);
  },
});

// ── Video upload (disk, no transcoding) ──────────────────────────────────────
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (req: any, file, cb) => {
      const uid = (req.user?.uid ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      // Determine file extension from mimetype
      let ext = 'mp4';
      if (file.mimetype === 'video/webm') ext = 'webm';
      else if (file.mimetype === 'video/quicktime') ext = 'mov';
      else if (file.mimetype === 'video/x-msvideo') ext = 'avi';
      cb(null, `video_${uid}_${Date.now()}.${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) { cb(new Error('Only video files are allowed')); return; }
    cb(null, true);
  },
});

// ── POST /api/upload/photo ────────────────────────────────────────────────────
router.post('/photo', authenticateToken, upload.single('photo'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const filename = `${req.user!.uid.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${filename}`;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.profilePictures.length >= 6) return res.status(400).json({ error: 'Maximum 6 photos allowed' });

    await prisma.user.update({
      where: { id: user.id },
      data: { profilePictures: [...user.profilePictures, url] },
    });

    res.json({ url });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
});

// ── POST /api/upload/video — add to library, auto-set as active if first ──────
router.post('/video', authenticateToken, videoUpload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, profileVideos: true, profileVideo: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

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
  } catch (err: any) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: err.message ?? 'Video upload failed' });
  }
});

// ── DELETE /api/upload/video — remove specific video from library ─────────────
router.delete('/video', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, profileVideos: true, profileVideo: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedVideos = user.profileVideos.filter((v) => v !== url);
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
      const filename = url.split('/uploads/videos/').pop();
      if (filename) {
        const filepath = path.join(VIDEOS_DIR, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    } catch { /* ignore */ }

    res.json({ profileVideos: updatedVideos, profileVideo: activeVideo });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// ── PUT /api/upload/video/active — set which video shows in the feed ──────────
router.put('/video/active', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
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
router.delete('/photo', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = user.profilePictures.filter((p) => p !== url);
    await prisma.user.update({ where: { id: user.id }, data: { profilePictures: updated } });

    try {
      const filename = url.split('/uploads/').pop();
      if (filename) {
        const filepath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    } catch { /* ignore */ }

    res.json({ profilePictures: updated });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ── PUT /api/upload/photos/reorder ───────────────────────────────────────────
router.put('/photos/reorder', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { photos } = req.body as { photos: string[] };
    if (!Array.isArray(photos)) return res.status(400).json({ error: 'photos array required' });

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, profilePictures: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const owned = new Set(user.profilePictures);
    const safe = photos.filter((u) => owned.has(u));
    await prisma.user.update({ where: { id: user.id }, data: { profilePictures: safe } });
    res.json({ profilePictures: safe });
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// ── POST /api/upload/post-media — video OR image for social posts ─────────────
const postMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (req: any, file, cb) => {
      const uid = (req.user?.uid ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      let ext = 'mp4';
      if (file.mimetype === 'video/webm') ext = 'webm';
      else if (file.mimetype === 'video/quicktime') ext = 'mov';
      else if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) ext = 'jpg';
      else if (file.mimetype.includes('png')) ext = 'png';
      else if (file.mimetype.includes('webp')) ext = 'webp';
      else if (file.mimetype.includes('gif')) ext = 'gif';
      cb(null, `post_${uid}_${Date.now()}.${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/') && !file.mimetype.startsWith('image/')) {
      cb(new Error('Only video or image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.post('/post-media', authenticateToken, postMediaUpload.single('media'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;
    res.json({ url });
  } catch (err: any) {
    console.error('Post media upload error:', err);
    res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
});

// ── POST /api/upload/video-message — video attached to a chat message ─────────
router.post('/video-message', authenticateToken, videoUpload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/videos/${req.file.filename}`;

    res.json({ url });
  } catch (err: any) {
    console.error('Video message upload error:', err);
    res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
});

export default router;
