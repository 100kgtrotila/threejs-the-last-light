# Phase 2: Gothic Island Environment and Spatial Validation

## Implemented

- Authored major landmarks, grave and mausoleum footprints, navigation corridors, and three protected empty artifact sites at the approved anchors.
- Deterministic generation with seed 7419: 26 dead trees, 42 bushes, and 32 coastal rocks. Candidates are rejected against structures, cemetery grounds, routes, artifact clearings, other props, and the safe island boundary.
- Octagonal Gothic lighthouse with pointed windows, buttresses, balcony, lantern, and spire; twelve varied gravestones and two mausoleums; static ocean, irregular terrain, and continuous coastal cliffs.
- Paths are vertex colors on one continuous terrain surface, avoiding stacked coplanar path meshes. Foundations flatten the terrain beneath their authored footprints and blend back into the natural coastal surface.
- Debug view: gold colliders, blue exclusions, bounds for structures, artifact anchor axes, and red outlines for reported conflicts.

## Spatial validation contract

World matrices are updated before world-space bounds or transformed-vertex queries. Box3 selects candidate entity pairs; analytic circle/box/capsule checks decide collider conflicts. World-space vertices must remain inside their convex authored footprint, so a broad bounding-box overlap alone is never labeled a mesh intersection.

Grounding uses actual transformed geometry and terrain samples, allowing explicitly limited embedding for roots and rocks. Raycast regression tests independently check the rendered terrain beneath the lighthouse foundation and a rotated rock. Architectural joints inside one entity are intentional; support surfaces are distinguished from navigation obstacles.

The geometry audit checks finite vertices, consistent unit normals, triangle area, and duplicate triangles within each BufferGeometry. It is not a universal triangle-to-triangle intersection solver for an arbitrary model. Browser inspection complements it for assembled geometry. Crosses use one extruded silhouette to avoid partial coplanar overlap at box joints.

## Actual verification

- `npm test`: **21 passed**, 3 test files. Covers deterministic generation, exclusion rules, building/path conflicts, structure boundary containment, precise shapes, collider coverage, support contact, rendered-terrain raycasts, geometry defects, cross cap area, and lighthouse assembly contact.
- `npm exec tsc -- --noEmit`: **passed**.
- `npm run build`: **passed**. Vite reports one non-blocking chunk-size warning: approximately 591 kB minified / 152 kB gzip for the main bundle.
- Playwright browser: inspected landing, overview, cemetery, east/grove approach, and coast views, plus debug overview at 390×844 and wide views at 1280×720. One canvas rendered; runtime spatial issue count was zero. No horizontal page overflow in the narrow view.
- Browser console after fixes: **0 errors, 0 warnings**. Page resources returned successful 200/304 responses.
- Two browser mount/dispose cycles: each allocated one canvas and a shadow map, then removed the canvas and emitted shadow-target disposal. Repeated disposal and a start call after disposal did not remount the canvas.
- Hidden-to-visible host sizing restored a 1280×720 drawing buffer with one canvas.

Confirmed defects fixed during verification: approach routes entering the lighthouse/shore-site footprints, obsolete soft-shadow mode, duplicate cap surfaces in box-built crosses, terrain penetration under the lighthouse foundation, rotated-rock floating from approximate bounds, gaps in the lantern/roof assembly, and shadow-map cleanup.

No real mobile device or hardware performance benchmark was run. No player controls, interaction rules, collectibles, puzzle behavior, or complex weather were introduced.

## Manual review

Run `npm run dev`, open the displayed local URL, and use the Views links. Start with `?view=overview`, then inspect the landing, cemetery, grove, and coast. Use `?view=overview&debug=1` to inspect colliders and exclusion zones. Debug helpers are enabled only by the development server.
