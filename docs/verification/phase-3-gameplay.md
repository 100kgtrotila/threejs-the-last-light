# Phase 3 verification — 2026-10-20

## Automated checks

- `npm test`: 38 tests passed in 9 files.
- `npm exec tsc -- --noEmit`: passed.
- `npm run build`: passed. Vite reports a chunk-size warning: 611.79 kB minified, 158.28 kB gzip. No dependencies added.

Gameplay tests cover unique collection in different orders, premature puzzle/activation rejection, wrong-order reset without collection loss, terminal completion, snapshot isolation, normalized frame-independent movement, running, building sliding, thin-wall tunneling, rock collision, and the island boundary. Integration tests check that every authored navigation route remains traversable and actual lighthouse, mausoleum, gravestone, and rock footprints block passage.

Raycast tests cover nearest selection, reach, occlusion, hidden/disabled targets, and the actual lighthouse entrance assembly. Browser inspection found the entrance's brass center seam could intercept activation; grouping all entrance surfaces into one target fixed this. The added environment regression passes.

## Browser evidence

Inspected the actual WebGL scene with Playwright at 1920 × 889 and 800 × 650. No browser console warnings or errors were reported during the final fixture run. World spatial validation reported zero issues.

**Native pointer lock was rejected by the browser automation backend.** The application showed its capture-error feedback and remained paused. Native relative mouse capture is therefore unverified and needs a manual desktop check.

For the remaining checks, a browser-only fixture instantiated the same `Game`, replaced pointer-lock acquisition/release with a document event fixture, and exercised the real keyboard/mouse event handlers, scene raycasts, game state, and DOM buttons. No fixture hooks or pointer-lock substitutions are included in application code.

Verified with that fixture:

- W moved approximately 2.05 world units in 0.6 seconds at walking speed; F changed the flashlight status; Escape paused.
- Early lighthouse and dial interactions displayed locked feedback.
- Collected Wave, Grave, and Thorn via E and actual scene raycasts. Hidden collected symbols no longer blocked selection.
- Traversed shore-to-central, cemetery, grove, dial, and lighthouse routes through movement input and the real animation loop. Some viewpoints were positioned directly for targeted checks; this was not a fully unassisted playthrough.
- Read a memorial, displayed its clue, released the mouse fixture, and resumed.
- Wrong ritual input reset progress. Wave → Thorn → Grave enabled activation. Puzzle button focus persisted between inputs.
- Activated the centered lighthouse entrance via E and reached `completed`, with completion UI and released mouse fixture.
- Pushing toward the lighthouse stopped at z ≈ -22.267; pushing toward a gravestone stopped at z ≈ -4.98, outside its footprint.
- Window blur cleared held keys and stopped movement.
- Two disposal/remount cycles produced exactly one canvas and HUD per mount, zero spatial issues, and removed both on disposal. Disposed input listeners did not retain newly pressed keys. Double disposal was safe.
- Resize preserved the player view; the narrower modal remained readable without horizontal page overflow.

Screenshots captured locally under ignored `.playwright-mcp/` include the landing, shore collection, cemetery reading, solved dial, completion, and narrow pause dialog.

## Manual desktop review

1. Run `npm run dev`, open the default URL, and click Begin exploration. Confirm native mouse capture, yaw/pitch, and Escape release.
2. Check WASD, diagonals, Shift, flashlight orientation/toggle, and E prompts. Try pushing against graves, mausoleums, rocks, the lighthouse, and the coastal boundary.
3. Collect three symbols, read the memorials, try an incorrect ritual order, then enter Wave → Thorn → Grave and activate the entrance.
4. During movement, press Escape or switch tabs. Resume and confirm no stuck movement or unintended interaction.

No cross-browser/device performance or native pointer-lock claims are made. Collision deliberately uses horizontal player-circle movement with conservative building footprints, rock circles, and tree trunks; it does not provide jumping, stair simulation, or building interiors. No confirmed gameplay defects remain from the performed checks. Atmospheric polish remains deferred.
