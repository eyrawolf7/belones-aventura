import { defineConfig } from 'vite';
// base relativa: funciona igual en GitHub Pages (/belones-aventura/) que en local
export default defineConfig({ base: './', build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000 } });
