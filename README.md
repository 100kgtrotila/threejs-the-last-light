# The Last Light: Curse of the Forgotten Island

A compact university first-person horror project built with Three.js, TypeScript, and Vite. Explore an authored Gothic island, collect three ritual symbols, read memorial clues, solve the stone dial, and restore the lighthouse.

## Run

Requires Node.js 22.12+ within 22.x, 24.x, or 26.x and npm. The final audit used Node 26.8.1 and npm 11.19.0. A desktop browser with WebGL 2, keyboard, mouse, and Pointer Lock is required.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite in a desktop browser. Click **Begin exploration** to capture the mouse.

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Run |
| F | Toggle flashlight |
| E | Interact with the highlighted object within 2.5 metres |
| Escape | Pause and release the mouse |

Collect the symbols at the shore, cemetery, and grove. Read the cemetery memorials for the ritual order, align the stone dial, then activate the lighthouse at its entrance. Reading and ritual dialogs release the mouse; use their return button to resume. Progress lasts until the page reloads.

Restoring the lighthouse starts a seven-second ending: the camera eases back, the beacon brightens, the storm calms, and the fog clears before the completion message appears. With the operating system's reduced-motion preference enabled, the camera stays still; lightning, flicker, wind, and ocean motion are disabled, and the beam remains static.

Atmosphere settings live in `src/game/Atmosphere.ts` (`ATMOSPHERE_CONFIG`). Fog density, beam speed, ocean, wind, lanterns, lightning, apparition, and reduced motion are configurable. `new Game(host, { atmosphere: { lightning: false } })` overrides defaults without changing layout or gameplay rules.

Development environment review cameras remain available at `?view=overview`, `?view=cemetery`, and `?view=coast`. Add `&debug=1` for spatial overlays. Open the URL without `view` to play.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm test` runs Vitest unit and scene-data tests; it does not verify rendered pixels or native mouse capture. `typecheck` uses strict TypeScript. Preview serves the production build, normally at `http://localhost:4173`.

## Features and architecture

- Authored island, Gothic lighthouse, cemetery, dead grove, protected paths, cliffs, and ocean.
- Distance-limited, occlusion-aware interactions; memorial clues; unique collectibles; guarded ritual progression.
- Moonlight, warm lanterns, fog, animated ocean/wind, lightning, apparition, and timed finale.
- Seeded prop placement, geometry audits, player collision, resize handling, and resource cleanup.

| Module | Responsibility |
| --- | --- |
| `game/Game.ts` | One scene, renderer, camera, loop, resizing, and teardown |
| `world/layout.ts`, `environmentLayout.ts` | Coordinates, landmark anchors, reserved paths, seeded placement |
| `world/buildEnvironment.ts`, `buildLandmarks.ts`, `buildNature.ts`, `terrain.ts` | Procedural visual construction and grounding |
| `world/spatial.ts`, `sceneValidation.ts` | Shape checks, broad bounds, geometry and placement audits |
| `player/PlayerController.ts`, `physics/` | Pointer Lock, input, normalized movement, player-circle collision |
| `interaction/InteractionSystem.ts` | Center raycast, reach/occlusion checks, target highlight |
| `game/GameState.ts`, `Gameplay.ts` | Pure progression rules and scene/UI bindings |
| `game/Atmosphere.ts`, `atmosphereTimeline.ts`, `oceanAnimation.ts` | Effect timing, lighting, motion, ocean shader, finale |
| `ui/` | Instructions, objectives, prompts, dialogs, rendering-failure recovery |

The world is Y-up: +X east, −Z north; one unit represents approximately one metre. Visual meshes and authored collision footprints are separate. Physics is intentionally horizontal, with no jumping or traversable building interiors.

## Verification and limits

See the [final engineering/visual audit](docs/verification/final-audit.md) for actual results and the [technical walkthrough](docs/presentation/technical-walkthrough.md) for algorithms and a demonstration script.

Native Pointer Lock was rejected by the automation browser, so a manual desktop playthrough is still required. Browser fixtures verified input handlers and the ritual loop with substituted lock acquisition. Touch/gamepad controls and save persistence are not implemented. The build retains a bundle-size advisory, and no FPS target or cross-device performance result is claimed. Graphics startup/context failure presents a Reload button; reloading restarts progress.

## AI assistance

OpenAI Codex assisted with planning, TypeScript implementation, procedural geometry/shaders, tests, documentation, debugging, and browser-based checks. The user supplied the project requirements and directed the phases. AI-produced work was iteratively checked with TypeScript, Vitest, production builds, and browser fixtures; these checks do not establish untested hardware support or replace the presenter's understanding of the code.
