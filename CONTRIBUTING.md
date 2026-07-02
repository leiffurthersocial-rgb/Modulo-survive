# Contributing to MODULO: SURVIVE

Thanks for helping build the lattice. A few ground rules keep the project healthy.

## Development setup

```bash
npm ci
npm run dev        # dev server with HMR
npm run ci         # lint + typecheck + tests + build — must pass before any PR
```

## Architecture rules (enforced in review)

1. **Dependency direction:** `core ← data ← world ← game ← render/audio/ui`. Never import
   upward (e.g., `data/` must not import from `game/`). See `docs/ARCHITECTURE.md`.
2. **The simulation is deterministic.** No `Math.random`, `Date.now`, or DOM access inside
   `src/game`, `src/world`, `src/data`, `src/core` — randomness flows through `core/rng.ts`.
3. **Content is data.** New blocks/items/enemies/recipes/quests belong in `src/data/*` —
   if adding content requires engine changes, raise it in an issue first.
4. **No binary assets.** Art and audio are procedural; extend `render/textures.ts`,
   `render/sprites.ts` or `audio/*` instead of committing files.
5. **Saves are sacred.** Any change to chunk or save encoding bumps `SAVE_VERSION` and adds
   a migration + a roundtrip test.

## Workflow

- Branch from `main`, one topic per PR, conventional commit style
  (`feat: …`, `fix: …`, `docs: …`, `perf: …`, `test: …`).
- Add or update tests for anything in `core/world/game/save`.
- Update `CHANGELOG.md` under **Unreleased**.
- CI (GitHub Actions) must be green: lint, typecheck, tests, build.

## Reporting bugs

Open an issue with: world seed, dimension, coordinates (F3 debug overlay), browser, and
steps. Worldgen bugs are usually reproducible from seed + coordinates alone — include both.
