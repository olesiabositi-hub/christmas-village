<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- The app has no runtime dependency on Lovable services or external CDNs: images/fonts are local files in `src/assets/`. Why: project is handed over to self-hosting on GitHub Pages.
- `GITHUB_PAGES=1` (`build:pages`) builds a static SPA with base `/christmas-village/`; router `basepath` and asset URLs use `import.meta.env.BASE_URL`. Why: Pages serves from a sub-path.
- Scene magic effects (aurora, burst, footprints, extra buildings) live in `src/components/quest/Magic.tsx`; district data lives in `districts.ts`.
- Living-world rules (character state machine, weather, day/night, easter-egg storage) live in `src/components/quest/sim.ts` with no React/three imports, tested in `sim.test.ts`; `Living.tsx` only draws them. Why: physics/behaviour can't be seen in the sandbox, so rules must be unit-testable.
- Campus cabins, gingerbread houses and window offices live in `src/components/quest/Cabins.tsx`; time-of-day presets live in `sim.ts` and `TimeOfDay` in Scene eases sky/fog/lights and `world.glow`/`world.aurora` toward them. Why: one source of truth for lighting so every light-emitting part fades together.
- Campus mini-games: rules, localStorage progress, card-part unlocks and PR links/toast text in `src/components/quest/games/logic.ts` (tested), UI in `games/Games.tsx`, backdrop/FX in `QuestOverlay.tsx`; finale badge/card in `quest/finale/` (`CardArt` shared by lootbox and generator). Why: game rules stay unit-testable apart from visuals.
