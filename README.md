# MultiViewer Remote

A companion web app for [MultiViewer for F1](https://multiviewer.app) that lets you control and monitor your race viewing setup from a second screen — tablet, phone, or laptop — while watching on the big screen.

## Features

- **Controller** — Mirror your MultiViewer player layout and switch onboard cameras, toggle fullscreen, adjust volume, and seek feeds directly from the remote.
- **Leaderboard** — Real-time standings with positions, intervals, gaps to leader, and fastest lap highlights.
- **Position** — Visual graph tracking driver position changes throughout the session, including tire change indicators.
- **Tire Strategy & Stats** — View each driver's tire stints and compare lap time performance across different compounds.
- **Pitstops** — Simulate pitstop outcomes for any driver and see predicted positions on a visual timeline.
- **Race Control** — Browse official race control messages with driver filtering, track limit summaries, and penalty overviews.
- **Weather** — Live weather data with combined air/track temperature chart, wind speed, rainfall, humidity, and pressure plotted over time.
- **Race Info** — Session details, circuit track layout, and current weather conditions at a glance.

## Key Details

- Built with React, TypeScript, and Vite
- Fully responsive — optimized for desktop, tablet, and mobile with automatic layout detection
- Installable as a Progressive Web App (PWA)
- Supports Metric and Imperial units for temperature and wind speed
- All data stays on your local network — the app connects directly to MultiViewer's API with no external servers
- Requires MultiViewer for F1 with API access enabled

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Build for production:
   `npm run build`
