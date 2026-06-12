import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// SPA-сборка. base: './' — чтобы статика открывалась как файл/веб-страница внутри Electron.
export default defineConfig({
    plugins: [react()],
    base: './',
    server: { port: 5180, host: true },
    build: { outDir: 'dist', sourcemap: true },
});
