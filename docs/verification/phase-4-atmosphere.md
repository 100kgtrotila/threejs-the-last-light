# Phase 4: atmosphere and dynamic environment — 2026-10-20

Implements Task 11 of the approved design and implementation plan. Work continued in the existing repository to preserve the uncommitted Phase 2/3 environment and gameplay. No commits, dependency changes, layout changes, or collider changes were made for this phase.

## Implementation

- `game/Atmosphere.ts`: fog/sky, cold moonlight, three warm wall lanterns, rotating spotlight and soft beam haze, small branch-pivot/bush motion, one scripted keeper apparition, and restoration lighting/camera transition. Effects are separate from interaction and collision roots.
- `game/atmosphereTimeline.ts`: deterministic delta-time effect clock, occasional two-pulse lightning, one-shot apparition fade, and seven-second restoration progress.
- `game/oceanAnimation.ts`: GPU wave displacement with matching analytic normals; restrained crest reflections keep the dark water legible. No CPU geometry rewrite per frame.
- `game/Game.ts`: keeps the sole render loop, owns atmosphere lifetime, observes reduced-motion preference changes, skips hidden/zero-size rendering, and finishes the ending after restoration.
- `game/Gameplay.ts`: emits snapshots on progression changes; activation releases input and starts the ending. Atmosphere owns beacon lighting. Existing collection/puzzle/collision rules remain intact.
- `ui/Hud.ts`, `style.css`: restoration caption followed by final completion UI. `main.ts` updates development-review labels.

### Budgets and configuration

One shadow-casting directional moon light retains the existing shadow map. Effect lights cast no shadows: three local lantern point lights and one rotating spotlight; the player's existing flashlight is the second spotlight. No bloom, particles, external assets, or additional render loop.

`ATMOSPHERE_CONFIG` and the optional `Game` constructor settings control fog density, beam speed, ocean, wind, lanterns, lightning, apparition, and reduced motion. Motion calculations reuse vectors, quaternions, uniforms, and stored object handles. Raycast scratch storage is reused for the apparition's visibility check until it triggers.

Reduced motion disables wind, flicker, ocean motion, lightning, beam rotation, and automatic finale camera movement. The restoration fades and completion message still occur. The seven-second transition is driven by completed gameplay state; it cannot solve or bypass the ritual.

## Automated results

- Baseline: 38 tests passed before Phase 4 changes.
- Final `npm test`: **48 tests passed in 11 files**.
- `npm exec tsc -- --noEmit`: **passed**.
- `npm run build`: **passed**. Main chunk 627.97 kB minified / 163.22 kB gzip; Vite's existing 500 kB advisory remains.
- `git diff --check`: **passed** for tracked changes; Git reports normal LF/CRLF conversion notices.

New tests cover timestep equivalence, guarded restoration, bounded lightning, reduced motion, apparition progression/one-shot/pause behavior, stable collider and entrance-interaction data, disposal, and the narrow-camera apparition regression. Tests were first observed failing before implementation; the narrow-camera regression was observed failing before its fix.

## Browser results

Used Chromium WebGL 2.0 via Playwright, with 1200 × 800, 800 × 650, and 600 × 800 viewports. The development fixture instantiated the actual `Game`, stopped its loop for deterministic sampling, and rendered known viewpoints/times. No fixture or test hooks were added to application globals.

- **Passed:** landing silhouette and path visibility, cemetery lanterns/gravestones, grove route and symbol visibility, dial approach, coast, apparition, lightning peak, and restored lighthouse inspection.
- **Passed:** animated ocean produced different rendered frames at a fixed camera; shader compilation reported no errors. Added a subtle reflection floor after initial inspection showed the water was too dark to read.
- **Passed:** progress-triggered apparition fades in beside the central path and remains outside picking/collision roots. It does not trigger offscreen on the narrow viewport, but does trigger when the camera turns toward it.
- **Passed:** interaction fixture collected all three symbols with E, rejected a wrong dial input, accepted Wave → Thorn → Grave, and activated the real lighthouse entrance. It showed “The beacon awakens” during restoration and “The Last Light burns again” after seven simulated seconds. Viewpoints were positioned by the fixture; this was not an unassisted native-pointer-lock playthrough.
- **Passed:** final atmosphere uses lower fog density (0.0175 → 0.0105), a brighter sweeping beacon, calmer waves/wind, and no lightning. Completion occurs after the transition.
- **Passed:** reduced-motion mode kept the camera and branches still and disabled lightning while restoration still completed.
- **Passed:** hidden host measured 0 × 0, then recovered with the correct camera aspect and stable position. Disposal removed canvas/UI, double disposal was safe, and a new mount rendered with zero spatial issues.
- **Passed:** final production preview at `http://127.0.0.1:4173/` reached `sceneReady=true`, reported `spatialIssues=0`, and served HTML/JS/CSS successfully. No console errors or warnings in the final production navigation. A development navigation aborted during hot reload; it was not an asset failure.

Local screenshots are under ignored `.playwright-mcp/`.

### Confirmed defects fixed

1. The ocean/sky initially had a hard horizon seam. Installed Three.js shader/source inspection showed fog blends after tone mapping. An unlit gradient sky with matching fog color/output conversion removed the seam.
2. The apparition initially looked too solid. Lower opacity, a single rendered robe surface, and vertex alpha at its feet/hood softened it.
3. Independent review found that a fixed angular trigger could consume the one-shot apparition outside a narrow camera viewport. A failing regression reproduced it; eligibility now checks projected camera coordinates before triggering.
4. The beam's initial crisp edges were softened using view-angle alpha, retaining its real moving spotlight and depth testing.

## Limits and manual review

Native pointer lock remains unverified in this automation backend; the interaction fixture substituted acquisition/release and used the real input handlers. A fresh manual desktop playthrough, physical-device performance, other GPU/browser families, touch controls, and context-loss recovery were not verified. No frame-rate claim is made. There are no confirmed unresolved defects from the performed checks.

Run `npm run dev` and play the default URL. Development camera views remain at `?view=landing`, `?view=cemetery`, `?view=east`, `?view=dial`, and `?view=coast`; `&debug=1` enables spatial overlays. Inspect lantern flicker and wind, wait about 18 seconds for the first brief lightning sequence, collect a symbol and return toward the central route for the apparition, then complete the ritual and watch the ending. Repeat with the OS reduced-motion preference enabled.
