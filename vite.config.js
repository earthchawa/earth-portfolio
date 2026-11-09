import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Writes robots.txt + sitemap.xml into dist/ using VITE_SITE_URL from .env
function seoFiles(siteUrl) {
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod></url>\n` +
          `  <url><loc>${siteUrl}/about</loc><lastmod>${today}</lastmod></url>\n` +
          '</urlset>\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const { VITE_SITE_URL } = loadEnv(mode, process.cwd());
  return {
    plugins: [react(), tailwindcss(), seoFiles(VITE_SITE_URL)],
    // Three.js lives in its own lazy-loaded chunk (~540 kB), so this size is expected
    build: { chunkSizeWarningLimit: 600 },
  };
});
