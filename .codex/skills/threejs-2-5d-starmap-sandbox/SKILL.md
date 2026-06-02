---
name: threejs-2-5d-starmap-sandbox
description: Build or refine browser-based Three.js 2.5D sci-fi starmap sandboxes, especially orthographic node-only starsea maps with constrained pan/rotation, Bloom, flat tactical UI, boiling-water particle fields, diamond crystal nodes, glowing ground projection rings, height columns, and readable map-node data. Use when Codex is asked to create, tune, document, or preserve the workflow for a 2.5D 星海沙盘/星图节点可视化 rather than a full 3D star field, stellar-core model, or route graph.
---

# Three.js 2.5D Starmap Sandbox

## Core Workflow

1. Inspect the existing app first. Preserve its framework and data flow. For a blank folder, use a minimal static Three.js page or Vite app with a full-viewport `<canvas>`.
2. If working inside the Aether Era world project, read `AGENTS.md` and prefer the starsea geography blueprint/topic files before inventing map fields or civilization labels.
3. Use a 2.5D layout: map `x/z` to the main plane and convert the source `z` or tier/risk data into limited node elevation. Do not scatter nodes into a full 3D cloud unless the user explicitly asks.
4. Start node-only. Add edges, routes, or labels only when requested; dense node readability is the primary requirement.
5. Build the scene stack in this order: renderer, orthographic camera, constrained `OrbitControls`, postprocessing Bloom, particle field, map guide lines, instanced node layers, hover/selection markers, HUD.
6. Verify in the browser with screenshots. Check that the canvas is nonblank, controls pan/rotate within limits, shader materials compile without console errors, glow is visible, text does not overlap, and mobile framing remains usable.

## Three.js Stack

Use restrained postprocessing and bloom-friendly emissive materials:

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85-0.95;

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35-0.55,
  0.45-0.65,
  0.35-0.55,
);
```

Prefer an `OrthographicCamera` for the sand-table read. Enable only limited motion:

- `enablePan: true`, with explicit target clamps.
- `enableRotate: true`, with narrow azimuth and polar limits.
- bounded zoom; avoid free orbital flight.

## Visual Language

Use a flat sci-fi operations UI rather than a cosmic wallpaper. The scene should read as a map instrument:

- Dark debugging theme is best while tuning particles, height, and glow. A white/light theme can be restored later with reduced Bloom and darker particle contrast.
- Avoid large plastic-looking glow disks. Use thin projection rings, edge glows, transparent crystal facets, and small halos.
- UI panels should be quiet, dense, and scannable: restrained borders, compact controls, civilization swatches, status readouts, and no marketing hero layout.
- Use visual assets or project references when the user supplies them, but keep the WebGL map as the first-screen experience.

## Particle Field

For the "sci-fi water surface" layer, prefer points over a water mesh:

1. Create a broad, slightly tilted plane of `THREE.Points`.
2. Use white particles unless the user asks for civilization-colored particles.
3. Animate a sparse boiling-water pattern: large random lifts, evenly rising bubbles, rebound-like local peaks, and ring ripples without burst/explosion events.
4. Keep density low enough that individual waves are readable. If the user says the motion is too dense, reduce sampled points and event-cell count before shrinking opacity.
5. Keep particles below node priority. If glow disappears, reduce particle brightness or opacity before raising Bloom globally.

Good fragment behavior: circular point sprites with soft alpha, discard low-alpha fragments, `toneMapped: false`, additive or normal blending depending on brightness.

## Node Model

Use instanced layers for performance and consistency:

- Ground projection: flat `RingGeometry` with a shader that combines a core ring, softer outer halo, radial scan, subtle grain, additive blending, and `toneMapped: false`.
- Height column: open `CylinderGeometry` with a custom shader, edge light, base/top fade, vertical scan, additive blending, and low opacity. Keep it thin enough to indicate elevation without becoming a solid tube.
- Main node: transparent diamond/crystal, usually `OctahedronGeometry`, scaled taller than wide.
- Crystal face: subtle normal-blended shader for facets and internal brightness.
- Crystal glow: enlarged same geometry, additive, depth test off or carefully relaxed so glow remains visible.
- Wire/core: thin wireframe plus a smaller bright core; both should support the crystal, not replace it.
- Pick layer: invisible larger hit target for raycasting.

When tuning glow:

- First make the glow source bright enough and `toneMapped: false`.
- Then lower Bloom threshold or raise strength modestly.
- If the whole scene washes out, dim background particles before reducing node glow.
- Use browser console logs to separate shader errors from purely visual tuning issues.

## Data And Interaction

For worldbuilding starmaps, separate generated sample data from canon:

- Keep sample node names generic until formal nodes are approved.
- Include civilization, display tier, risk level, type/status, coordinates, and short metadata.
- Do not write procedurally generated sample nodes into worldbuilding canon files.
- Filters should operate on civilization and tier first. Risk focus can be a command button.
- Hover and selection markers should be lightweight rings/crosshairs, not large decorative panels.

## Validation Checklist

Before reporting completion:

- Run a syntax/build check appropriate to the app, for example `node --check` for static ES modules or the repo's normal build/test command.
- Refresh the local browser page after edits.
- Check console error/warn logs.
- Capture/inspect a desktop screenshot.
- Confirm the 2.5D height read is visible through crystal elevation, projection rings, and height columns.
- Confirm particle motion remains behind the nodes.
- Confirm constrained pan/rotation works and does not become a full 3D starfield camera.
- Update local README/map index/changelog when working in the Aether Era publishing structure.
