import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('./auth-firebase-fixture.ts', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  envDir: fileURLToPath(new URL('./auth-fixture-env', import.meta.url)),
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') },
  plugins: [
    {
      name: 'local-auth-fixture',
      enforce: 'pre',
      resolveId(source) {
        if (['firebase/auth', 'firebase/messaging', './firebase'].includes(source) || /^(?:\.\.\/)+lib\/firebase(?:\.ts)?$/.test(source)) return fixture;
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
});
