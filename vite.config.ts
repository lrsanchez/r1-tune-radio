import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 15000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/browse': 'http://localhost:3001',
      '/search': 'http://localhost:3001',
      '/tune':   'http://localhost:3001',
    },
  },
});
