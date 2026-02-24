# Flowmap (React + TypeScript + Three.js)

Wanderlust-style OD flow visualization adapted for `szflow.csv`.

## Features

- Black-scene 3D map with ground plane.
- OD movement rendered as animated particles on cubic Bezier paths with lateral offsets.
- Net retention peaks (`inbound - outbound`) aggregated by grid and stacked as particles.
- Adjustable aggregation spacing (`grid size`) for peak clustering.
- Optional basemap layer (network lines + anchor points) toggle.
- Day/night palette transitions driven by hour.
- Hourly mode uses smooth interpolation between adjacent hours (fade-in/fade-out feel).
- Extra distance-weighted micro-particles for subtle urban motion texture.
- Additive blending and optional bloom for glow effects.
- Orbit camera controls.
- UI controls:
  - minimum `total` threshold
  - aggregated vs hourly mode
  - hourly playback

## Project Structure

- `src/data`: types + runtime data loader
- `src/geometry`: reusable curve/ribbon geometry utilities (legacy layer kept)
- `src/shaders`: particle shaders for flow layer + peak layer
- `src/scene`: canvas scene, flow particles, net-retention peaks
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

## GitHub Pages

This project is configured for repository Pages at:

- `https://weipengdeng.github.io/flowmap/`

Deployment is handled by:

- `.github/workflows/deploy-pages.yml`

Setup steps:

1. Push to the `main` branch.
2. In GitHub repository settings, open `Pages`.
3. Set `Build and deployment` source to `GitHub Actions`.
4. Wait for the `Deploy To GitHub Pages` workflow to finish.
