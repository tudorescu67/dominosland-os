/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react')
            || id.includes('node_modules/react-dom')
            || id.includes('node_modules/scheduler')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/xterm')) {
            return 'terminal-vendor';
          }
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/axios')) {
            return 'network-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
  },
});
