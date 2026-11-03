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

Every push to `main` builds the site and uploads `dist/` over FTP — see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the secrets it needs.

`VITE_SITE_URL` in `.env` sets the domain used for SEO tags, `robots.txt` and `sitemap.xml`.

Manual fallback: `npm run build`, then upload everything inside `dist/` — including the hidden `.htaccess` — to `httpdocs/` (Plesk).
