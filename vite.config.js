import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/obsidian': {
        target: 'https://localhost:27124',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/obsidian/, ''),
        secure: false,
      },
    },
  },
});
