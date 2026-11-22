import dotenv from 'dotenv';

// Production credentials must come from the deployment environment.
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.dev' });
}
