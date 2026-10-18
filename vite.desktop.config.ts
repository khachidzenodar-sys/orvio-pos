import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Static build of the local (demo) POS for the Tauri desktop shell.
// The Next.js app (app/**, next.config.ts) is not involved.
const repo = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
 root: resolve(repo, 'desktop'),
 publicDir: resolve(repo, 'public'),
 plugins: [react()],
 resolve: {alias: {'@': repo}},
 build: {outDir: resolve(repo, 'dist-desktop'), emptyOutDir: true},
 server: {port: 5174, strictPort: true},
 clearScreen: false,
});
