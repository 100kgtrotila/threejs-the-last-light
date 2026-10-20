# Final engineering and visual-quality audit

Date: 2026-10-20. Scope: correctness, reliability, diagnostics, presentation, and measured workload; no new gameplay features. Earlier Phase 2–4 work was already uncommitted when this audit began and was preserved. No commits or external filesystem changes were made.

## Improvements and evidence

| Finding | Evidence before fix | Correction and repeat check |
| --- | --- | --- |
| Invalid apparition normals | Full rendered-scene audit found 17 non-unit normals on the final LatheGeometry profile row (length ≈ 0.309). Existing world-only audits had not covered it. | Normalize the owned lathe normals; name robe/face meshes. New regression failed first, then passed. Full scene geometry audit now returns no issues. |
| Blank screen when WebGL creation fails | Production page with WebGL contexts disabled produced an uncaught renderer error, empty body text, and no canvas. | Shared rendering-failure UI catches startup failure and offers Reload. Repeat had no uncaught page error; enabling WebGL and pressing Reload produced one canvas and the start screen. Expected diagnostics still log the controlled failure. |
| No context-loss recovery message | `WEBGL_lose_context` left `sceneReady=true` with no failure/reload UI. | Stop the loop, release Pointer Lock, clear readiness, and present Reload. Real context-loss injection showed the message; Reload restored a ready scene. No automatic renderer recreation. |
| Retired context remained live | A rendered Game still had `isContextLost() === false` after disposal. Three.js's shared DFG lookup cache also remains in renderer counters. | After resource/listener disposal, explicitly release the retired canvas context. Three new mount/dispose cycles reported lost contexts, zero registered geometries, no canvas/HUD, and no spurious failure overlay. Do not dispose the library's shared texture globally. |
| Idle collision/terrain work | 600 idle updates performed 600 terrain samples despite unchanged position. | Early return for zero movement. Repeat: zero samples across 600 idle updates; 60 walking updates still travelled 3.4 units and sampled 60 times. No FPS claim follows from this micro-check. |
| Fog obscured spatial debug overlays | Overview screenshot showed barely visible bounding/exclusion lines. | Debug line materials ignore fog and depth occlusion. Repeated overview screenshot showed readable gold/blue bounds, paths, and axes. Default scene rendering is unaffected. |

Added strict TypeScript checking to `tsconfig.json` and an explicit `npm run typecheck` script. Added installation/architecture/testing/AI-assistance documentation and a technical demonstration walkthrough.

## Passing checks

| Check | Actual result |
| --- | --- |
| `npm test` | **49/49 passed**, 11 test files |
| `npm run typecheck` | **Passed**, strict TypeScript |
| `npm run build` | **Passed**, Vite 8.3.4 |
| `git diff --check` | Passed for tracked changes; normal Windows LF/CRLF conversion notices |
| Deterministic placement | Existing tests reproduce seed 7419, distinguish seed 7420, validate default placements and reject structure/path/boundary conflicts |
| Collision | Existing tests cover tunneling, sliding, circle/box obstacles, actual structure/rock placements, all authored routes, and inset island boundary |
| Game state | Existing tests cover unique collection, multiple collection orders, early-input rejection, wrong-order reset, required ritual completion, terminal completion, and snapshot isolation |
| Full scene geometry | No invalid normals, nonfinite vertices, degenerate or duplicate triangles reported after the fix |
| Scene placement/transforms | 120 entity placements checked after animation: no grounding, footprint, or collider conflicts; browser traversal found zero nonfinite world transforms |
| Production smoke check | `sceneReady=true`, `spatialIssues=0`, one canvas; final HTML/JS/CSS requests successful; zero final-navigation console warnings/errors |

No lint or formatting command is configured, so neither is reported as having passed. A clean-machine dependency installation was not repeated; the existing locked dependencies were used. Audit tooling used Node 26.8.1/npm 11.19.0, Three.js 0.186.1, TypeScript 6.0.3, and Vitest 5.0.5.

## Browser and visual verification

Chromium WebGL 2.0 was available. Inspected normal landing, overview/debug, grove, dial/lighthouse approach, coast, close cross/pointed gravestones, and a close mausoleum entrance. Checked normals/face readability, support contact, silhouette contrast, paths, lantern lighting, clipping, and screenshots. No additional confirmed visual defect was found in those views. The distant overview intentionally has heavy atmospheric haze; the diagnostic lines remain readable.

The deterministic gameplay fixture instantiated the actual `Game` and froze/stepped its existing loop. Pointer-lock acquisition was substituted only in browser test code. Viewpoints were positioned for targeted checks, so this is not an unassisted manual playthrough.

Verified:

- W travels 3.4 units in one simulated second; Shift+W travels 5.8. Real keyboard events reached the controller. Synthetic relative mouse events changed yaw/pitch as expected; F toggled the flashlight.
- Escape released the lock fixture; held movement cleared and resume stayed stationary until another key press.
- Forward pressure stopped outside the lighthouse at z ≈ -22.267. The island-edge check stopped at z ≈ 32.627. Automated tests separately cover all actual major structure/rock footprints and reserved navigation routes.
- The locked lighthouse displayed guarded feedback. E read a memorial and released the lock fixture. All three real symbol raycasts succeeded; pressing E twice did not duplicate collection.
- A wrong dial symbol reset progress to 0/3; Wave → Thorn → Grave unlocked activation. At three seconds the ending caption remained active; after seven seconds completion displayed.
- Begin again performed a real page reload and reset symbols to 0/3, with one canvas and HUD.
- Live emulation of `prefers-reduced-motion` updated atmosphere configuration in both directions.
- 600 × 800 and 900 × 450 resize checks kept the start dialog and controls within the viewport without horizontal page overflow. Hidden-to-visible testing recovered from 0 × 0 with aspect 0.75 and stable camera position.
- Three mount/dispose cycles aborted Game, Gameplay, PlayerController, and Hud listener signals, removed UI/canvas, and returned registered geometry count to zero. Final teardown also explicitly lost each retired GL context.
- Startup failure and real context-loss/reload checks passed as described above.

One development navigation timed out; retrying the same overview/debug URL reached readiness with zero spatial issues and no console or resource error. This was not reproduced. Controlled graphics-failure tests intentionally generated diagnostic output; the final normal production navigation was clean. Screenshots are captured locally under ignored `.playwright-mcp/`.

## Architecture review

The existing boundaries remain appropriate: pure layout/spatial/state rules, visual builders, input, raycast interaction, orchestration, atmosphere, and DOM presentation. `Game` remains the sole render-loop and renderer owner. The small shared rendering-failure helper serves two real recovery paths. No new physics engine, asset loader, render abstraction, or dependency was introduced.

An independent read-only code review found no additional actionable defects in gameplay, input, state, collision, HUD, or their cleanup. It also measured interaction selection at approximately 0.094 ms over 500 Node iterations on the actual world. That is a CPU micro-check, not a browser/GPU benchmark. The picker still allocates intersection results and some scratch objects; a broad interaction rewrite was not justified by that measurement.

Spatial validation is conservative and authored: Box3 selects candidates and exact 2D footprint tests determine conflicts. It does not prove the absence of every possible arbitrary triangle intersection. Internal masonry joints, supported surfaces, and slight rock embedding are deliberate; screenshots and focused geometry tests supplement the automated rules.

## Performance observations and limits

At a fixed **1200 × 800** landing view, camera `(0, 1.7, 26)` looking toward `(0, 4, -27)`:

- Scene inventory: 545 meshes, 52 distinct geometry objects, 22 materials, approximately 80,684 modelled triangles including hidden objects.
- Renderer counters: **848 calls / 88,012 submitted triangles**, including shadow work.
- Diagnostic render without updating the shadow map: **327 calls / 75,632 submitted triangles**. Shadow updates account for 521 additional calls in that sample; normal rendering retains those shadows.
- Rendered geometry registrations: 49; texture counter: 3 while active. After ordinary asset disposal, one Three.js DFG lookup texture remains in its counter; releasing the retired context also releases that context's engine-owned GPU resources. Counters are not a driver-memory measurement.
- One shadow-casting directional light; three lantern point lights and two spotlights (including flashlight) have no shadow maps. Pixel ratio is capped at 1.5.
- Production JS chunk: **629.56 kB minified / 163.71 kB gzip**. Vite's >500 kB advisory remains.

Shadow draw-call count and bundle size remain optimization candidates. Repeated props share geometry/materials but are not batched into instanced draws. The audit avoided an unmeasured scene rewrite. No FPS target, sustained frame-rate result, GPU timing, heap-retainer result, or physical laptop/mobile benchmark is claimed.

## Unavailable or not performed

- **Native Pointer Lock:** the browser backend rejected capture. The application remained paused and showed capture-error feedback. Native relative mouse capture requires a manual check on the presentation computer.
- **Unassisted desktop playthrough:** not performed; browser fixtures and state/collision tests verified the covered paths.
- **Other browsers/GPU families, physical mobile/touch/gamepad, assistive technology, and long-duration memory/performance testing:** not performed. The game requires desktop keyboard/mouse; viewport checks do not establish mobile gameplay support.

There are no remaining failed unit/type/build checks. The above limitations prevent a claim that every environment or input configuration works.

## Files changed during this audit

- `src/game/Atmosphere.ts`, `src/game/Atmosphere.test.ts`
- `src/game/Game.ts`, `src/player/PlayerController.ts`
- `src/world/buildEnvironment.ts`
- `src/ui/renderFailure.ts`, `src/main.ts`, `src/style.css`
- `tsconfig.json`, `package.json`
- `README.md`, `docs/presentation/technical-walkthrough.md`, this report

Launch and demonstration instructions are in the [README](../../README.md) and [technical walkthrough](../presentation/technical-walkthrough.md). The walkthrough includes module/algorithm explanations, AI-use disclosure guidance, and a four-minute sequence.
