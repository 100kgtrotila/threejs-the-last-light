# Phase 3: First-Person Exploration and Interactive Gameplay

1. Test and implement pure game state (`exploration`, `puzzle`, `activation`, `completed`), collection, ordered dial inputs, and guarded completion.
2. Test and implement horizontal player-circle collision against existing building/grave/rock footprints, tree trunks, and the safe ellipse. Normalize movement and integrate speed with elapsed time.
3. Test raycast selection with maximum reach, occlusion, hidden/disabled targets, and nearest-hit ordering. Highlight with one owned Box3Helper without changing shared materials.
4. Add a pointer-lock controller with WASD, Shift, F, E, Escape; clear held input on unlock, blur, hidden document, and teardown. Keep one render loop in Game.
5. Build three ritual symbol displays on existing pedestals, memorial messages, dial interaction, and lighthouse entrance activation. Separate scene binding, state, controls, interaction, and DOM HUD. Reading and puzzle dialogs release pointer lock; resume requires an explicit click.
6. Verify unit tests, TypeScript, production build, and actual browser controls/playthrough. Check interruption recovery and cleanup. Preserve environment review cameras behind development query views. Do not add atmospheric polish or unrelated mechanics.
