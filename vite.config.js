import { defineConfig } from 'vite';

export default defineConfig({
  // './' keeps asset URLs relative — required for the Electron desktop build
  // (served from 127.0.0.1) and for opening dist/ from any path.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
