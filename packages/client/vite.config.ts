import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: Number(process.env.CLIENT_PORT) || 5173,
    host: true,
    proxy: {
      '/health': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@arena/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
