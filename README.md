# Flowmap (React + TypeScript + Three.js)

Wanderlust-style OD flow visualization adapted for `szflow.csv`.

## Features

- Black-scene 3D map with ground plane and destination peaks.
- Cubic Bezier flow ribbons with:
  - width from normalized weight `w`
  - 4 directional color bands using per-flow `cuts`
  - broken-stroke alpha mask + noise discard in shader
  - additive blending and optional bloom
- Orbit camera controls.
- Destination hover/click highlighting for connected flows.
- UI controls:
  - minimum `total` threshold
  - aggregated vs hourly mode
  - hourly playback

## Project Structure

- `src/data`: types + runtime data loader
- `src/geometry`: flow ribbon geometry builder
- `src/shaders`: custom flow shader material
- `src/scene`: canvas scene, peaks, ribbons
- `src/utils/createStrokeAlphaMask.ts`: canvas-based alpha mask fallback
- `scripts/prepare-data.mjs`: CSV -> `/public/data` converter

## Data Files

Generated into `/public/data`:

- `meta.json`
- `nodes.json`
- `destinations.json`
- `flows.json`
- `flows-hourly.json`

## Run

1. Install dependencies:
   - `npm install`
2. Regenerate data from CSV (optional if data already exists):
   - `npm run prepare-data`
3. Start:
   - `npm run dev`

