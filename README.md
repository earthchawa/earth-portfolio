# earth.

Personal portfolio of **Chawaphong (Earth) Khunsoongnoen** — frontend developer, UX/UI designer and lecturer at NKRAFA.

Live at **[earthcha.com](https://earthcha.com)**

## Stack

- React 19 + Vite
- Tailwind CSS v4
- Three.js — a flyable cartoon planet: visitors steer chibi Earth on a paper plane to landmarks that each open a card (about, education, projects, contact). A "Quick view" shows the same content without the game.

Content lives in `src/world/data.js`; the 3D scene is in `src/world/` (`world.js` flight + camera, `planet.js`, `chibi.js`, `models.js`).

## Develop

```bash
npm install
npm run dev
```

## Deploy (Hostatom)

Every push to `main` builds the site and uploads `dist/` over FTP — see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the secrets it needs.

`VITE_SITE_URL` in `.env` sets the domain used for SEO tags, `robots.txt` and `sitemap.xml`.

Manual fallback: `npm run build`, then upload everything inside `dist/` — including the hidden `.htaccess` — to `httpdocs/` (Plesk).
