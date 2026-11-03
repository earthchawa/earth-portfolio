# earth.

Personal portfolio of **Chawaphong (Earth) Khunsoongnoen** — frontend developer, UX/UI designer and lecturer at NKRAFA.

Live at **[earthcha.com](https://earthcha.com)**

## Stack

- React 19 + Vite
- Tailwind CSS v4
- Three.js — one particle system that morphs between a dotted Earth, a paper plane, `</>`, a 35mm lens and a graduation cap as you scroll

## Develop

```bash
npm install
npm run dev
```

## Deploy (Hostatom)

1. Set `VITE_SITE_URL` in `.env` (used for SEO tags, `robots.txt` and `sitemap.xml`).
2. `npm run build`
3. Upload everything inside `dist/` — including the hidden `.htaccess` — to `public_html/`.
