import { defineConfig } from 'vite';

// The game talks to Obsidian (https://127.0.0.1:27124) and Claude directly from the browser,
// so no dev proxy is needed. See README for the one-off self-signed certificate step.
export default defineConfig({});
