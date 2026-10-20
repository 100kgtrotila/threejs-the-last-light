# Technical walkthrough: The Last Light

## 1. Runtime and ownership

`main.ts` creates the DOM host and starts `Game`. `Game` owns one renderer, scene, perspective camera, ResizeObserver, and animation loop. Frame order is player/gameplay update → atmosphere update → completion handoff → render. Delta time is limited to 0.1 seconds to avoid a large jump after an interruption. Hidden or zero-sized surfaces skip updates/rendering.

`dispose()` stops the loop, disconnects observers, aborts event listeners, disposes gameplay and atmospheric assets, disposes world geometry/materials and shadow targets, and releases the retired renderer's WebGL context. Repeated disposal is safe. Startup failure and context loss show a Reload recovery screen; there is no automatic renderer recreation loop.

## 2. Authored layout and procedural placement

Use a right-handed, Y-up world: +X east, −Z north, eye height 1.7 units. Landmark anchors come from `world/layout.ts`. The visible island is approximately 90 × 70 units, with a smaller safe ellipse for the player. The lighthouse is north of the landing; the cemetery and grove branch west/east from the central route.

`createEnvironmentLayout` defines structures and exclusion zones before placing props. A seeded linear congruential generator makes repeated placement reproducible. Candidate trees, bushes, and rocks are rejected if they cross a protected path, landmark clearing, building footprint, another prop, or the boundary. A changed seed can change decoration while preserving the same authored navigation contract.

Meshes are grouped at their anchors. Repeated simple geometry is shared through `MeshLibrary`; decorative instances are ordinary meshes, so sharing buffers does not by itself reduce draw calls.

## 3. Geometry and spatial validation

The world builder updates world matrices before bounds queries. Grounding uses transformed vertices and the terrain sampler, rather than assuming that a rotated mesh's approximate bounding box touches the ground. Rocks deliberately embed slightly; building foundations contact their support surfaces.

`validateScenePlacements` uses world-space Box3 bounds to find candidate conflicts, then circle/box/capsule footprint checks decide spatial conflicts. Box3 overlap alone is not treated as proof of triangle intersection. This is a practical authored-world validator, not a universal mesh Boolean/intersection engine. Internal masonry joints and ground support contacts are deliberate.

`auditGeometry` checks finite positions, unit normals, degenerate triangles, and duplicated triangles within shared geometries. The final audit found non-unit normals at the end of the apparition's lathe profile in the installed Three.js version; normalizing that geometry fixed the regression without changing its silhouette.

## 4. First-person movement and collision

`PlayerController` owns Pointer Lock, held keys, yaw/pitch, and the camera-mounted flashlight. Mouse deltas adjust yaw/pitch with a vertical limit. Movement input is normalized so diagonals do not move faster; walk/run speeds are 3.4/5.8 units per second, multiplied by delta time and rotated by camera yaw. With no movement input, collision and terrain sampling are skipped.

`movePlayer` uses a horizontal circle of radius 0.35. Long movement is divided into steps no longer than half that radius, which prevents tunneling through thin blockers. X and Z are resolved separately, allowing wall sliding. Buildings/graves use authored box or circle footprints; rocks use circles; trees use trunk circles. The boundary check keeps the player inside an inset safe ellipse. This avoids the cost and complexity of a general physics engine for a mostly level island.

## 5. Interaction and game rules

`InteractionSystem` casts a ray from the camera centre with maximum reach 2.5 units. The first visible hit must belong to an enabled interactable; a nearer solid object blocks selection. One Box3Helper highlights the selected target. Thin symbol glyphs have camera-hidden raycast volumes so their open centres remain usable.

`GameState` contains the rules independently of rendering or the DOM:

```text
exploration -- three unique symbols --> puzzle
puzzle -- Wave, Thorn, Grave --> activation
activation -- lighthouse interaction --> completed
```

Wrong dial input resets only dial progress. Early dial input and lighthouse activation are rejected. Collection is idempotent. Completed is terminal. Snapshots copy the collected-symbol list so a consumer cannot mutate internal state.

`Gameplay` binds these rules to symbols, gravestones, the dial, and lighthouse entrance. `Hud` displays objectives and feedback. Reading and puzzle dialogs release Pointer Lock; a button click resumes exploration. Domain completion starts the ending, and the final completion dialog waits until the atmosphere transition has finished.

## 6. Atmosphere and rendering budget

`AtmosphereClock` provides deterministic lightning, one-shot apparition timing, and seven-second restoration progress. The apparition requires collected progress, a projected on-screen location, distance, and a clear ray before it can trigger.

The ocean shader displaces vertices and computes matching analytic normals from two moving sine waves. Branch pivots and bush yaw add small motion without moving trunks or changing collider data. The beacon rotates a spotlight and a soft transparent cone; three local point lights illuminate lanterns. Only the moon casts dynamic shadows. Reduced motion disables lightning, wind, flicker, ocean movement, beam rotation, and the automatic finale camera move.

Renderer counters at the fixed 1200 × 800 landing view reported 848 draw calls including shadow work and 88,012 submitted triangles. A diagnostic render without updating the shadow map reported 327 calls. These are workload counters, not FPS measurements. Batching repeated geometry and shadow-pass cost are future profiling candidates; the audit did not introduce a broad rendering rewrite.

## Suggested four-minute demonstration

| Time | Action / explanation |
| --- | --- |
| 0:00–0:30 | Show the start screen. Explain WASD, mouse, Shift, F, E, and Escape; identify the lighthouse silhouette. |
| 0:30–1:30 | Collect the shore symbol, follow the central/west path, read a memorial, and show that a grave/building blocks movement. Collect the cemetery symbol. |
| 1:30–2:15 | Cross to the grove, demonstrate running/flashlight and pause/resume, collect the final symbol. Return toward the lighthouse. |
| 2:15–2:50 | Enter one wrong dial symbol, then Wave → Thorn → Grave. Activate the entrance and let the seven-second ending finish. |
| 2:50–3:40 | Show `Game`, layout data, circle collision, and `GameState` tests. Explain seeded placement and shader-based ocean motion. |
| 3:40–4:00 | Show verification results, disclose AI assistance, state native-pointer-lock/device-performance limits, and optionally press Begin again. |

Before presenting, test native Pointer Lock on the actual university computer. Use `npm run dev` for development review cameras; production preview intentionally hides those development controls. If screen sharing prevents mouse capture, show the development cameras and describe that limitation rather than claiming a successful native playthrough.
