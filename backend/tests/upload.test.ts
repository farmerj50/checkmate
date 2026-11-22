import express from 'express';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));

describe('Upload dependency compatibility', () => {
  let app: express.Express;
  let directory: string;
  let png: Buffer;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'vipi-upload-unit-'));
    // The router captures cwd at import; keep all generated media in this fixture.
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory);
    try {
      const { default: router } = await import('../src/routes/upload');
      app = express().use(express.json()).use('/api/upload', router);
    } finally {
      cwd.mockRestore();
    }
    png = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: '#345678' },
    }).png().toBuffer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({
      id: 'fixture-user', isActive: true, dateOfBirth: new Date('1990-01-01'),
      profilePictures: [], profileVideos: [], profileVideo: null,
    });
    db.user.update.mockResolvedValue({});
  });

  afterAll(async () => {
    if (directory && path.dirname(directory) === path.resolve(os.tmpdir()) &&
        path.basename(directory).startsWith('vipi-upload-unit-')) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('authenticates before writing video files', async () => {
    const res = await request(app).post('/api/upload/video-message')
      .attach('video', Buffer.from('fixture'), { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(401);
    expect(await readdir(path.join(directory, 'uploads/videos'))).toEqual([]);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('resizes a multipart PNG to a JPEG and persists its URL', async () => {
    const res = await request(app).post('/api/upload/photo')
      .set('Authorization', 'Bearer demo_upload')
      .attach('photo', png, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    const filename = path.basename(new URL(res.body.url).pathname);
    const metadata = await sharp(path.join(directory, 'uploads', filename)).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 800, height: 400 });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'fixture-user' }, data: { profilePictures: [res.body.url] },
    });
  });

  it('rejects photos over the 10 MB limit without persisting them', async () => {
    const res = await request(app).post('/api/upload/photo')
      .set('Authorization', 'Bearer demo_upload')
      .attach('photo', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.png', contentType: 'image/png',
      });
    expect(res.status).toBe(413);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('rejects unexpected multipart fields and cleans up partial disk uploads', async () => {
    const videos = path.join(directory, 'uploads/videos');
    const before = await readdir(videos);
    const res = await request(app).post('/api/upload/post-media')
      .set('Authorization', 'Bearer demo_upload')
      .attach('media', Buffer.from('fixture'), { filename: 'clip.webm', contentType: 'video/webm' })
      .field('extra', 'unexpected');
    expect(res.status).toBe(400);
    expect(await readdir(videos)).toEqual(before);
  });

  it.each(['photo', 'video'])('cleans up a %s when persistence fails', async kind => {
    const dir = path.join(directory, 'uploads', ...(kind === 'video' ? ['videos'] : []));
    const before = await readdir(dir);
    db.user.update.mockRejectedValueOnce(new Error('Fixture database failure'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app).post('/api/upload/' + kind).set('Authorization', 'Bearer demo_upload')
        .attach(kind, kind === 'photo' ? png : Buffer.from('fixture'), { filename: kind === 'photo' ? 'a.png' : 'a.mp4', contentType: kind === 'photo' ? 'image/png' : 'video/mp4' });
      expect(res.status).toBe(500);
      expect(await readdir(dir)).toEqual(before);
    } finally { log.mockRestore(); }
  });

  it.each([false, true])('rejects inactive or underage accounts before writing media (%s)', async isActive => {
    db.user.findUnique.mockResolvedValue({ id: 'fixture-user', isActive, dateOfBirth: new Date(isActive ? '2015-01-01' : '1990-01-01') });
    const videos = path.join(directory, 'uploads/videos');
    const before = await readdir(videos);
    const res = await request(app).post('/api/upload/video-message').set('Authorization', 'Bearer demo_upload')
      .attach('video', Buffer.from('fixture'), { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(403);
    expect(await readdir(videos)).toEqual(before);
  });

  it('deletes an owned upload but refuses foreign files and raw or encoded traversal', async () => {
    const owned = 'https://app.test/uploads/demo_upload_owned.jpg';
    const foreign = 'https://app.test/uploads/demo_someone_else.jpg';
    const file = path.join(directory, 'uploads/demo_upload_owned.jpg');
    const other = path.join(directory, 'uploads/demo_someone_else.jpg');
    await writeFile(file, 'owned'); await writeFile(other, 'other');
    const malicious = ['https://app.test/uploads/../package.json', 'https://app.test/uploads/%2e%2e%2fpackage.json'];
    // Even a legacy poisoned profile cannot grant ownership of another account's file.
    db.user.findUnique.mockResolvedValue({ id: 'fixture-user', isActive: true, dateOfBirth: new Date('1990-01-01'), profilePictures: [owned, foreign, ...malicious] });
    for (const url of [foreign, ...malicious]) {
      expect((await request(app).delete('/api/upload/photo').set('Authorization', 'Bearer demo_upload').send({ url })).status).toBe(403);
    }
    expect(db.user.update).not.toHaveBeenCalled();
    expect((await request(app).delete('/api/upload/photo').set('Authorization', 'Bearer demo_upload').send({ url: owned })).status).toBe(200);
    expect(await readFile(other, 'utf8')).toBe('other');
    expect(await readdir(path.dirname(file))).not.toContain(path.basename(file));
  });

  it.each([
    ['/api/upload/video', 'video'],
    ['/api/upload/video-message', 'video'],
    ['/api/upload/post-media', 'media'],
  ])('stores one video through %s', async (route, field) => {
    const bytes = Buffer.from('multipart video storage fixture');
    const res = await request(app).post(route)
      .set('Authorization', 'Bearer demo_upload')
      .attach(field, bytes, { filename: 'clip.webm', contentType: 'video/webm' });
    expect(res.status).toBe(200);
    const filename = path.basename(new URL(res.body.url).pathname);
    expect(filename).toMatch(/\.webm$/);
    expect(await readFile(path.join(directory, 'uploads/videos', filename))).toEqual(bytes);
    if (route === '/api/upload/video') {
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'fixture-user' },
        data: { profileVideos: [res.body.url], profileVideo: res.body.url },
      });
    }
  });
});
