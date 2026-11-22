// Keep unit tests independent of developer credentials and the integration database.
process.env.NODE_ENV = 'test';
process.env.DEMO_AUTH_ENABLED = 'true';
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:9/unit?connect_timeout=1';
for (const key of [
  'FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CONFIG',
  'GOOGLE_APPLICATION_CREDENTIALS', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
]) {
  process.env[key] = '';
}
process.env.OPENAI_API_KEY = 'unit-test-key';
process.env.ANTHROPIC_API_KEY = 'unit-test-key';
