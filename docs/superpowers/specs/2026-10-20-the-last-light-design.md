# The Last Light: Curse of the Forgotten Island — Design Specification

## Intent and scope

Build a small, polished university Three.js first-person atmospheric horror experience. A complete playthrough should take about 10–15 minutes: explore one authored island, collect three symbols, solve one environmental order puzzle, and activate a Gothic lighthouse. Navigation, geometry, collision, and clear sightlines take priority over decorative detail. The lighthouse interior is one minimal activation space.

The MVP includes WASD movement, mouse look with pointer lock, a toggleable flashlight, object interaction, three collectible symbols, a stone-dial puzzle, fog, dynamic lighting, restrained weather and animation, a beacon finale, and concise UI feedback. It excludes enemies, combat, save games, procedural terrain, branching narrative, complex interiors, and a general physics engine.

## World and coordinates

Use Three.js's right-handed Y-up system. +X is east; −Z is north. The ground is approximately Y=0. Model the land as an authored, mostly level island with visible semiaxes of 45 units east–west and 35 units north–south. The safe player-center boundary has semiaxes 43 and 33. The player's horizontal collision radius is 0.35 units, eye height is 1.7 units, and collision clearance is at least 0.2 units beyond that radius.

| Landmark | Anchor (X, Z) | Role |
| --- | --- | --- |
| Landing | (0, 26) | Spawn, orientation toward lighthouse |
| Shore | (−10, 23) | Wave symbol and clue |
| Cemetery | (−22, −2) | Grave symbol and clue |
| Dead grove | (22, 2) | Thorn symbol and clue |
| Stone dial | (7, −17) | Puzzle, outside the lighthouse |
| Lighthouse | (0, −27) | Beacon and minimal interior |

A 4-unit-wide central route runs from the landing to the south lighthouse approach, with western and eastern spurs to the cemetery and grove. The dial sits east of the spine so it does not block the route. The exact mesh details may change, but landmark anchors, path corridors, and clearances remain data-driven and checked. The lighthouse should be visible from the landing and at each branch junction. Fog may soften it, but must not erase its navigational role.

Each landmark uses a group at its anchor. Meshes, interaction points, and simple colliders use local coordinates relative to that group. World coordinates are calculated only when needed for queries; world matrices are updated before synchronous bounds queries after transform changes. Geometry ownership and disposal are explicit.

## Gameplay contract

The player can collect wave, grave, and thorn symbols in any order. Clues establish the stone-dial sequence **wave → thorn → grave**. The dial accepts input only after all three have been collected. Each correct input advances progress; an incorrect input resets dial progress to zero, with immediate visual and textual feedback. Collected symbols remain collected. Completing the sequence unlocks the lighthouse's activation control. Activating it triggers a timed beacon, lighting, fog, and weather transition and ends with a clear completion message. No player death or soft lock is intended.

Interactions require a visible target within 2.5 units of the player and a clear line of sight. Prompts identify the action and disappear when the target leaves range or view. The flashlight can be switched on and off throughout exploration.

## Architecture

`main.ts` creates the host and starts `Game`. `Game` owns one renderer, one perspective camera, one animation loop, resizing, update order, and teardown. `world/layout.ts` is the source of truth for landmark anchors, route corridors, clearance rules, and stable IDs. World builders create visual groups from it. `physics/collision.ts` resolves horizontal player movement against authored solid circles/axis-aligned boxes and the safe island boundary. `player/PlayerController.ts` owns input and view orientation. `interaction/InteractionSystem.ts` selects eligible targets and invokes registered actions. `game/GameState.ts` owns symbols and puzzle/activation transitions. `game/Atmosphere.ts` owns time-dependent light, fog, weather, and finale effects. `ui/Hud.ts` presents controls, prompts, status, and ending.

Visual geometry, collision geometry, and interaction targets are distinct data. Use built-in Three.js geometry for simple shapes, custom `BufferGeometry` only where silhouette requires it, and instancing only for repeated noninteractive meshes with stable instance IDs if picking is needed. Keep a renderer pixel-ratio budget, resize from the host element, skip zero dimensions, and release listeners, resources, and owned render targets on teardown.

## Implementation order and quality gates

Phase 1 is a **static world blockout**: establish layout data and spatial tests, renderer lifecycle, simple ground/landmark masses, path visualization, and fixed review cameras. No WASD movement, pointer lock, collectibles, or puzzle behavior is implemented in this phase. Review the landing sightline, route width, island boundary, and landmark spacing before adding detail.

Phase 2 adds collision and movement, then interaction. Phase 3 adds test-backed game state and puzzle UI. Phase 4 adds restrained world art, dynamic atmosphere, and the lighthouse finale. Each phase must preserve navigable corridors and pass its relevant build/tests and visual inspection before the next phase.

Automated tests cover spatial placement constraints, collision resolution, interaction eligibility, and game-state transitions. Visual checks cover desktop and narrow viewports, resizing, hidden-to-visible behavior, camera sightlines, normals and culling, collider overlays, overlapping solid meshes, flashlight readability, and a full manual playthrough. The existing project uses npm and `npm run build`; a focused test runner may be added when the first spatial tests are implemented.
