# Workwiki Mobile

Mobile companion PWA for the desktop knowledge management tool.

## Features

- Read wiki pages and daily markdown notes via GitHub API
- Quick memo capture to `inbox/` folder
- Calendar-based journal browsing
- Bridge to Claude app via Web Share API
- Offline reading with Service Worker cache
- Light/Dark/System Auto theme with Liquid Glass chrome

## Tech Stack

- React 18 + TypeScript 5.3 (strict)
- Vite 5 + vite-plugin-pwa
- Tailwind CSS 3
- Cloudflare Pages

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # type check + production build
npm run preview  # preview production build
```

## Deployment

See [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) for Cloudflare Pages deployment guide.

## Project Structure

See [SPEC v5](./docs/WORKWIKI_MOBILE_SPEC_v5.md) §10 for full folder structure.
