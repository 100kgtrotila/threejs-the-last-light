# The Last Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. The project instruction forbids commits unless the user requests them, so no task includes a commit step.

**Goal:** Deliver a compact, polished, 10–15 minute first-person island experience that ends with lighthouse activation.

**Architecture:** One `Game` owns the Three.js renderer and loop. Authored layout data drives visuals, collision, and validation; pure game rules remain independent of rendering. Complete and review the static spatial blockout before player movement, interaction, or decoration.

**Tech Stack:** Three.js 0.186.x, TypeScript 6.0.x, Vite 8.3.x, npm, and Vitest added as a development dependency when spatial tests begin.

**Spec:** `docs/superpowers/specs/2026-10-20-the-last-light-design.md`

## Global Constraints

- Preserve the approved compact authored island and modular architecture.
- Prioritize world layout, geometry, collider boundaries, walkable paths, and sightlines before decoration.
- Phase 1 is a static blockout. It contains no WASD movement, pointer lock, collectibles, or puzzle behavior.
- Use Y-up coordinates, +X east, −Z north; the landmark anchors and safe island boundary are defined in the spec.
- Keep the lighthouse interior to one small activation space.
- Use npm, the existing Three.js/Vite/TypeScript stack, and the existing `npm run build` check. Do not add a physics engine.
- Add automated tests for placement, collision, and game state as their respective systems are implemented.
- Keep interactions reachable and recoverable; the puzzle order is wave → thorn → grave.
- Do not commit, push, or create a pull request unless the user asks.

## Review Focus

The following conditions need explicit tests in the owning tasks, beyond the normal happy-path checks:

1. A landmark or solid obstacle encroaches on a reserved path: layout validation rejects it (Task 1).
2. Player movement is aimed diagonally into an island edge or obstacle corner: collision keeps the player inside and allows sliding where space exists (Task 4).
3. Pointer lock is lost while a movement key is held: movement stops and a later lock starts with clean input (Task 5, manual browser check).
4. Two interactables overlap in camera view: selection is deterministic and ignores targets behind a solid obstacle (Task 6).
5. The player enters a wrong dial symbol or activates early: progress resets or activation stays locked without losing collected symbols (Task 7).

## File map and dependency order

| Files | Responsibility | First task |
| --- | --- | --- |
| `src/world/layout.ts`, `src/world/validateLayout.ts` | Typed anchors, corridors, footprints, placement checks | 1 |
| `src/game/Game.ts`, `src/main.ts`, `src/style.css`, `index.html` | Canvas lifecycle, camera, host UI shell | 2 |
| `src/world/buildBlockout.ts` | Static ground, landmark proxies, collider/path overlay | 3 |
| `src/physics/collision.ts` | Pure horizontal movement and safe-boundary resolution | 4 |
| `src/player/PlayerController.ts` | Input, pointer lock, camera pose, flashlight | 5 |
| `src/interaction/InteractionSystem.ts` | Target selection, reach, visibility, dispatch | 6 |
| `src/game/GameState.ts` | Collectibles and puzzle/activation transitions | 7 |
| `src/ui/Hud.ts`, `src/game/bindGameplay.ts` | Prompts, controls, state-to-world actions | 8 |
| `src/world/buildLandmarks.ts` | Finished landmarks and minimal lighthouse room | 10 |
| `src/game/Atmosphere.ts` | Fog, weather, lighting, animation, finale | 11 |
| `src/**/*.test.ts` | Focused pure-rule tests colocated with owning modules | 1, 4, 6, 7 |

Dependencies are linear through Task 9. Tasks 10 and 11 may be reviewed separately, but both consume the completed layout and game flow. Task 12 verifies the integrated result.

## Phase 1 — Spatial contract and static world blockout

### Task 1: Authored layout and placement validation

**Files:** Create `src/world/layout.ts`, `src/world/validateLayout.ts`, `src/world/validateLayout.test.ts`; modify `package.json` and `package-lock.json` to add a `test` script and Vitest dev dependency.

**Interfaces:** `layout.ts` exports `type Point2 = { x: number; z: number }`, `type SymbolId = 'wave' | 'thorn' | 'grave'`, `type Footprint = { id: string; center: Point2; radius: number; solid: boolean }`, `type Corridor = { id: string; from: Point2; to: Point2; width: number }`, `type WorldLayout`, and `const WORLD_LAYOUT: WorldLayout`. `validateLayout(layout: WorldLayout): string[]` returns actionable violation messages; an empty list means valid. Keep landmark IDs stable for later interaction and state mapping. Landmark zones are nonsolid; only physical obstacles use `solid: true`.

**Acceptance:** The spec's six anchors are present. Visual land semiaxes are 45/35; safe player-center semiaxes are 43/33. The central and branch corridors are 4 units wide. The layout reserves 0.35 player radius plus 0.2 clearance around solid footprints. Corridors terminate before building footprints and connect to clear doorway approach points, so validation needs no broad exception. The default layout validates.

- [ ] Add Vitest as a dev dependency using npm and define `"test": "vitest run"` in `package.json`.
- [ ] Write tests for the default layout, a moved landmark outside the safe boundary, overlapping solid footprints, and a new solid footprint blocking a corridor; assert specific IDs appear in errors.
- [ ] Run `npm test -- src/world/validateLayout.test.ts`; confirm the new tests fail before implementation.
- [ ] Implement the typed data and `validateLayout`, using circle/segment distance for corridor clearance and boundary checks. Keep doorway approach points outside solid footprints.
- [ ] Run `npm test -- src/world/validateLayout.test.ts` and `npm run build`; both must pass.

### Task 2: Single-renderer shell and fixed review camera

**Files:** Create `src/game/Game.ts`; replace starter content in `src/main.ts`, `src/style.css`, and `index.html`. Remove starter imports from the entry point; deletion of unused starter assets can wait.

**Interfaces:** `Game` exposes `start(): void` and `dispose(): void`; constructor receives the canvas host element. It owns one renderer, scene, perspective camera, resize observer, frame loop, and any event listeners. The initial camera is fixed at the landing at eye height, looking north. Add a fixed overview camera preset for layout review through a development-only URL parameter, without player controls.

**Acceptance:** A full-viewport canvas renders a clear placeholder scene. Resizing uses the host element's nonzero dimensions, a capped device pixel ratio, and updates camera projection and renderer together. Teardown stops rendering and frees owned GPU resources/listeners; remounting does not duplicate the loop. A narrow viewport does not distort the image. No gameplay input exists yet.

- [ ] Replace the starter shell and implement the smallest scene and lifecycle that show the ground and camera presets.
- [ ] Run `npm run build`; it must pass without TypeScript errors.
- [ ] Run `npm run dev`; inspect landing and overview presets at wide and narrow sizes, then resize and hide/show the tab. Record any rendering defect before proceeding.

### Task 3: Static island, landmark masses, and layout overlay

**Files:** Create `src/world/buildBlockout.ts`; modify `src/game/Game.ts` to use it.

**Interfaces:** `buildBlockout(scene: THREE.Scene, layout: WorldLayout): WorldHandles & { dispose(): void }`, with `type WorldHandles = { symbols: Record<SymbolId, THREE.Object3D>; dialChoices: Record<SymbolId, THREE.Object3D>; beaconControl: THREE.Object3D }` exported from this module. `SymbolId` comes from `layout.ts` and is re-exported by `GameState` in Task 7; do not define it twice. The function consumes Task 1 layout data and creates static geometry only. Add a development-only overlay switch showing safe boundary, corridor widths, anchors, and solid footprints.

**Acceptance:** The landing, shore, cemetery, grove, dial, and lighthouse are visually distinct proxy masses at the authored anchors. There is a walkable central route and two branch routes, with the dial east of the spine. The lighthouse is visible from the landing and both branch junctions. The static ground has no gaps, inverted normals, or accidental solid-proxy intersections. The minimal lighthouse room is only outlined in this phase. No movement, interaction, collectibles, or puzzle logic is present.

- [ ] Build the ground with simple built-in geometry and reusable proxy meshes/materials; use groups at landmark anchors. Create custom `BufferGeometry` only if a built-in shape cannot express the required silhouette.
- [ ] Run `npm test -- src/world/validateLayout.test.ts` and `npm run build`; both must pass.
- [ ] Inspect spawn, overview, and junction viewpoints with the overlay on and off. Confirm route widths, clear sightlines, island edge, and object spacing. Stop for a blockout review before adding movement or decoration.

## Phase 2 — Collision, movement, and interaction

### Task 4: Pure collision world

**Files:** Create `src/physics/collision.ts`, `src/physics/collision.test.ts`; modify `src/world/layout.ts` only if a collider representation needs a typed field.

**Interfaces:** Export `type Collider2 = { id: string; shape: 'circle'; center: Point2; radius: number } | { id: string; shape: 'box'; center: Point2; halfX: number; halfZ: number }` and `movePlayer(start: Point2, delta: Point2, radius: number, colliders: readonly Collider2[], boundary: { radiusX: number; radiusZ: number }): Point2`. Static collider data comes from layout/landmark builders, not mesh bounding boxes.

**Acceptance:** The player center remains within the safe ellipse and outside solid colliders after each move. Axis-separated or equivalent resolution allows wall sliding. Movement from a valid start never teleports through a thin blocker; movement into corners remains finite and stable. Non-solid decoration does not block movement.

- [ ] Write tests for open movement, circle contact, box contact, diagonal sliding, obstacle corners, and diagonal movement against the island boundary.
- [ ] Run `npm test -- src/physics/collision.test.ts`; confirm failure before implementation.
- [ ] Implement `movePlayer` with bounded substeps for long frame deltas and clear, deterministic horizontal resolution.
- [ ] Run the focused test and `npm run build`; both must pass.

### Task 5: First-person controller and flashlight

**Files:** Create `src/player/PlayerController.ts`; modify `src/game/Game.ts`, `src/style.css`, and `src/ui/Hud.ts` only for the minimal start/pause controls needed now.

**Interfaces:** `PlayerController` exposes `update(deltaSeconds: number): void`, `position: Point2`, `camera: THREE.PerspectiveCamera`, and `dispose(): void`; it consumes `movePlayer` and colliders. `Game` calls it from the sole frame loop. Keep input state private to the controller.

**Acceptance:** WASD and mouse look work after an explicit pointer-lock gesture. Escape releases lock; held keys are cleared on unlock, blur, and disposal. Movement is frame-rate independent and cannot cross colliders or the safe island boundary. A flashlight follows the camera and toggles with one documented key. A locked cursor has no visible stray pointer. The landing sightline remains correct at player eye height.

- [ ] Implement controller input, camera yaw/pitch limits, collision-backed movement, pointer-lock handling, and a capped flashlight cone.
- [ ] Run `npm test -- src/physics/collision.test.ts` and `npm run build`; both must pass.
- [ ] Manually check movement along every route, wall sliding, edge behavior, lock/unlock, blur while holding a key, and flashlight visibility at wide and narrow viewports.

### Task 6: Deterministic interaction targeting

**Files:** Create `src/interaction/InteractionSystem.ts`, `src/interaction/InteractionSystem.test.ts`; modify `src/game/Game.ts` to update it and display a provisional prompt.

**Interfaces:** `type InteractionTarget = { id: string; position: THREE.Vector3; radius: number; enabled: () => boolean; interact: () => void }`. `InteractionSystem` exposes `select(camera: THREE.Camera, playerPosition: THREE.Vector3, targets: readonly InteractionTarget[], blockers: readonly Collider2[]): InteractionTarget | null` and `activateSelected(): void`. Stable IDs break equal-distance ties.

**Acceptance:** An eligible target must be within 2.5 units, in the camera's central aim cone, enabled, and unobstructed by a solid blocker. The nearest eligible target wins; equal-distance ties are stable. The prompt disappears immediately when selection is lost. One keypress invokes at most one action.

- [ ] Write tests for reach, view direction, disabled targets, solid occlusion, overlapping targets, and stable tie breaking.
- [ ] Run `npm test -- src/interaction/InteractionSystem.test.ts`; confirm failure before implementation.
- [ ] Implement selection and event dispatch without coupling it to puzzle state.
- [ ] Run the focused test and `npm run build`, then manually inspect prompts at the shore, cemetery, grove, dial, and lighthouse door.

## Phase 3 — Playable rules and feedback

### Task 7: Pure symbol, dial, and beacon state machine

**Files:** Create `src/game/GameState.ts`, `src/game/GameState.test.ts`.

**Interfaces:** Re-export `SymbolId` from `layout.ts`; export `type GameSnapshot`, `type GameTransition = { snapshot: GameSnapshot; result: 'collected' | 'duplicate' | 'locked' | 'correct' | 'incorrect' | 'unlocked' | 'activated' | 'alreadyActivated' }`, and `class GameState` with `collect(symbol: SymbolId): GameTransition`, `enterDial(symbol: SymbolId): GameTransition`, `activateBeacon(): GameTransition`, and `snapshot(): GameSnapshot`. A snapshot states collected symbols, dial progress, unlock status, and activation status.

**Acceptance:** Collection is order-independent and idempotent. The dial is locked until all three symbols are collected. Correct inputs follow wave → thorn → grave. An incorrect input resets only dial progress. Beacon activation is impossible before the full sequence and idempotent afterward. No state transition can soft lock a run.

- [ ] Write tests for duplicate collection, all collection orders, dial locked early, correct sequence, wrong entry reset, premature activation, and repeated activation.
- [ ] Run `npm test -- src/game/GameState.test.ts`; confirm failure before implementation.
- [ ] Implement the smallest pure state machine with explicit result codes and readonly snapshots.
- [ ] Run the focused test and `npm run build`; both must pass.

### Task 8: Collectible symbols and status HUD

**Files:** Create `src/game/bindGameplay.ts`, `src/ui/Hud.ts`; modify `src/game/Game.ts`, `src/world/buildBlockout.ts`, `src/style.css`, and `index.html`.

**Interfaces:** `WorldHandles` from `src/world/buildBlockout.ts` remains the contract for its art replacement. `bindGameplay(interactions: InteractionSystem, state: GameState, world: WorldHandles, hud: Hud): { dispose(): void }` registers stable landmark actions. `Hud` exposes `showPrompt`, `showStatus`, `showMessage`, and `showEnding`.

**Acceptance:** A fresh run can collect all three symbols in any order. The status HUD updates once per unique symbol and shows a concise objective. Each location has a readable clue, together establishing wave → thorn → grave. Controls and feedback are legible, keyboard accessible, and unobtrusive. Static blockout assets may remain visually simple.

- [ ] Wire the three symbol objects and clue displays to `GameState` through `InteractionSystem`; show collection and duplicate feedback in the HUD.
- [ ] Run `npm run test` and `npm run build`; both must pass.
- [ ] Manually collect all three symbols in a non-clue order and verify each HUD transition and clue legibility.

### Task 9: Dial puzzle and minimal lighthouse activation

**Files:** Modify `src/game/bindGameplay.ts`, `src/ui/Hud.ts`, `src/world/buildBlockout.ts`, and `src/game/Game.ts`.

**Interfaces:** Reuse the `GameState` transitions and `WorldHandles` contract from Tasks 7–8. The dial exposes three clearly labeled symbol inputs at one stone-dial landmark; the beacon control is inside a single small lighthouse activation space.

**Acceptance:** A fresh run can collect the symbols, enter wave → thorn → grave, enter the lighthouse, and activate the beacon. The dial is inert with clear locked feedback until all three symbols are collected. Incorrect entry resets dial progress and gives a recoverable message. Beacon activation cannot happen early and repeated use has predictable feedback. The art can remain a blockout.

- [ ] Wire the three dial choices and beacon control to state transitions and HUD feedback, including locked, incorrect, unlocked, and activated outcomes.
- [ ] Run `npm test` and `npm run build`; both must pass.
- [ ] Complete a fresh run, a deliberately wrong dial sequence, and an attempted early beacon activation; verify all outcomes in the browser.

## Phase 4 — Art, atmosphere, and finish

### Task 10: Replace proxies with restrained landmark geometry

**Files:** Create `src/world/buildLandmarks.ts`; modify `src/world/buildBlockout.ts` and `src/game/Game.ts`. Keep layout/collider data unchanged unless a measured clearance issue requires a reviewed update.

**Interfaces:** `buildLandmarks(scene: THREE.Scene, layout: WorldLayout): WorldHandles & { dispose(): void }`. It creates grouped lighthouse, cemetery, dead grove, rocks, shoreline markers, and dial details at Task 1 anchors.

**Acceptance:** Each landmark reads from the path and from its junction. The lighthouse is Gothic in silhouette; the interior has only one small activation space. Gravestones, trees, and rocks enrich edges without narrowing reserved corridors or hiding objectives. Decorative mesh overlap is intentional and visually coherent. Repeated noninteractive geometry may use `InstancedMesh` with stable IDs if picking is required; geometry and materials are disposed only when their last owner releases them.

- [ ] Replace blockout masses incrementally, preserving anchor groups and separate collider shapes. Check custom geometry normals, triangle winding, and bounds after transform changes.
- [ ] Run placement and collision tests plus `npm run build`; all must pass.
- [ ] Inspect all route viewpoints with collider overlay, checker material where useful, directional light, and camera-edge culling. Check every objective remains reachable.

### Task 11: Dynamic atmosphere and lighthouse finale

**Files:** Create `src/game/Atmosphere.ts`; modify `src/game/Game.ts`, `src/game/bindGameplay.ts`, and `src/style.css` as needed for finale feedback.

**Interfaces:** `Atmosphere` exposes `update(deltaSeconds: number, snapshot: GameSnapshot): void` and `dispose(): void`. It owns lighting/fog/weather animation and the timed activation transition; it does not own puzzle rules.

**Acceptance:** Low-cost weather and ambient motion convey a stormy island. The flashlight and landmark cues remain readable through fog. Lighthouse activation visibly changes beacon light, fog, and weather, then shows a completion message. Motion honors `prefers-reduced-motion`; rendering remains usable on a typical laptop at a capped pixel ratio. No new gameplay systems or expanded interior are added.

- [ ] Add restrained animated weather, tree/cloth movement where appropriate, dynamic light cues, and a deterministic beacon transition driven by state.
- [ ] Run `npm run test` and `npm run build`; both must pass.
- [ ] Manually compare before/after activation at fixed viewpoints and check reduced-motion, flashlight contrast, hidden-to-visible recovery, and performance on available hardware.

### Task 12: Integrated visual and gameplay verification

**Files:** Update only files with defects demonstrated by the checks; document results in `docs/verification/the-last-light.md`.

**Interfaces:** No new runtime interface.

**Acceptance:** A complete playthrough works from landing to beacon. All three symbol locations and the dial are reachable. The player cannot leave the island, walk through solids, or become trapped by decoration. There are no unexplained solid-object overlaps, inverted faces, camera clipping surprises, blank-canvas lifecycle failures, or missing prompts. Wide and narrow viewport captures show clear paths and sightlines. Any remaining limitation is recorded with a reproduction path.

- [ ] Run `npm run test` and `npm run build`; record actual outputs.
- [ ] Capture fixed viewpoints at landing, shore, cemetery, grove, dial, lighthouse, and activated lighthouse with collider overlay where relevant.
- [ ] Perform a fresh full playthrough and an error-recovery playthrough; record findings and fix only demonstrated defects.
- [ ] Re-run the affected tests/build after each fix and complete the verification note.

## Plan self-review

The tasks cover every MVP requirement in the spec. Task 1 establishes spatial constraints before visuals, Task 3 is a hard blockout review before movement, Tasks 4 and 7 add automated tests with their systems, and Tasks 10–11 add decoration only after a playable path exists. No task requires a physics engine, procedural terrain, expanded interior, or an unrequested commit. The five review-focus conditions are assigned to owning tasks.
