# MODULO: SURVIVE

An original 2D sandbox survival game that runs in your browser. Infinite procedural worlds,
seven constructible dimensions, day/night survival, crafting, base building, bosses, NPCs,
farming, machines and world events — with a fully procedural pixel-art and audio pipeline
(the repository ships zero binary assets).

**Stack:** TypeScript · React 18 · PixiJS 8 (WebGL) · Vite 6 · Web Workers · IndexedDB · WebAudio

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173
```

Production build & preview:

```bash
npm run build
npm run preview
```

Quality gates (same as CI):

```bash
npm run ci         # lint + typecheck + tests + build
```

## Controls (default)

| Action | Input |
|---|---|
| Move / jump | A · D / Space (double-tap ledges: hold toward wall to climb as Jovan) |
| Mine / attack / use | Left mouse — **hold** to keep mining or auto-attack |
| Place block / interact | Right mouse |
| Hotbar | 1–0 / mouse wheel |
| Inventory & crafting | E |
| Map | M |
| Quest log | J |
| Dodge roll | Shift |
| Pause / settings | Esc |

Gamepad and mobile touch controls are built in; keys are rebindable in Settings.

**Forgiving controls:** targeting snaps to the nearest block within reach, so you
don't need pixel-perfect aim (the reticle shows exactly what you'll hit). Melee,
bows and wands have aim assist that bends toward the nearest enemy in front of
you, and holding the attack button auto-repeats — combat and mining work well on
both desktop and touch.

## Repository layout

```
docs/        design bible: game design, architecture, worldgen, lore, networking, roadmap
src/core     seeded RNG, noise, math, events, RLE codec
src/data     declarative content: 200+ blocks, 250+ items, recipes, enemies, dimensions…
src/world    chunk storage, generation (worker), lighting, liquids
src/game     simulation: player, combat, AI, bosses, NPCs, farming, events, portals
src/render   PixiJS renderer, procedural texture/sprite baking, particles, weather
src/audio    procedural WebAudio SFX + generative music
src/save     IndexedDB persistence behind a storage adapter
src/input    keyboard/mouse, gamepad, touch
src/ui       React menus, HUD, inventory, map, settings
tests/       Vitest suites (worldgen determinism, saves, crafting, combat…)
```

Start with [docs/DESIGN.md](docs/DESIGN.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment

Pushes run CI (lint → typecheck → test → build) via GitHub Actions. The project is a static
Vite site; `vercel.json` is preconfigured — import the repo in Vercel and it deploys with no
further setup.

## License

[MIT](./LICENSE)
