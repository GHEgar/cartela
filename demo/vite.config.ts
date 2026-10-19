import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const src = (path: string): string => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [react()],
    optimizeDeps: { exclude: ['maplibre-gl'] },
    resolve: {
        alias: [
            { find: /^cartela\/video$/, replacement: src('video/index.ts') },
            { find: /^cartela\/maplibre$/, replacement: src('maplibre/index.ts') },
            { find: /^cartela\/react$/, replacement: src('react/index.ts') },
            { find: /^cartela$/, replacement: src('core/index.ts') },
        ],
    },
    build: {
        outDir: fileURLToPath(new URL('../demo-dist', import.meta.url)),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: fileURLToPath(new URL('index.html', import.meta.url)),
                maplibre: fileURLToPath(new URL('maplibre.html', import.meta.url)),
            },
        },
    },
});
