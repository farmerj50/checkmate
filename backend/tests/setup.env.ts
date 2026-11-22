const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('Set TEST_DATABASE_URL to an isolated localhost test database');
const parsed = new URL(testUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !/test/i.test(parsed.pathname)) {
  throw new Error('Integration tests require a localhost database whose name contains test');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.DEMO_AUTH_ENABLED = 'true';
for (const key of ['FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
  process.env[key] = '';
}
