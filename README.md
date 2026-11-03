# Christmas Magic Quest (2GIS)

A 3D winter village with five campus mini-games, a lootbox and a Christmas card maker.
Built with TanStack Start, React 19, React Three Fiber and Tailwind CSS v4.

## Requirements

- **Node.js 22** (tested with 22.23)
- **Bun 1.x** (the lockfile is `bun.lock`). npm also works, but then the lockfile is not used.

## Commands

```sh
bun install            # install dependencies
bun run dev            # dev server at http://localhost:8080
bun run test           # unit tests (vitest)
bun run build          # normal production build (server + client, Cloudflare target)
bun run build:pages    # static build for GitHub Pages under /christmas-village/ -> dist/client
```

Preview the static build locally:

```sh
bun run build:pages
mkdir -p /tmp/site && rm -rf /tmp/site/christmas-village && cp -r dist/client /tmp/site/christmas-village
cd /tmp/site && python3 -m http.server 8099   # open http://localhost:8099/christmas-village/
```

## Environment variables

None are required. `GITHUB_PAGES=1` is set by `build:pages` and switches the build to
static SPA mode with base path `/christmas-village/`.

## GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`.
In the repository go to **Settings → Pages → Source: GitHub Actions** once.
The repository must be named `christmas-village` (or change `base` in `vite.config.ts`).

## Assets

All images (`src/assets/quests/*.webp`) and the Onest font (`src/assets/fonts/*.ttf`)
live in the repository. Music and sound effects are synthesized in the browser
(`src/components/quest/audio.ts`); there are no audio, 3D model or HDR files.

## External links (opened in a new tab by the user)

- https://t.me/rnd2GIS
- https://job.2gis.ru/vacancies
