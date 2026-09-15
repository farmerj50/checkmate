import request from 'supertest';
import app from '../src/server';

async function run() {
  try {
    const res1 = await request(app).post('/api/social/posts').send({});
    console.log('unauthenticated create status', res1.status);

    const res2 = await request(app).post('/api/social/posts').set('Authorization', 'Bearer demo_user').send({});
    console.log('demo token empty body status', res2.status);

    const ok = res1.status === 401 && res2.status === 400;
    process.exit(ok ? 0 : 2);
  } catch (e) {
    console.error('Test runner error', e);
    process.exit(2);
  }
}

run();
