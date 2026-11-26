# EnviroShield AI

EnviroShield AI is an offline-first disaster awareness and evacuation application. It combines a stored Peddapuram-area road graph, live or cached telemetry, hazard zones, shelter and closure data, and GPS-aware route guidance in a mobile-friendly dashboard.

The repository contains a React/TanStack web application that can also be built and run as an Android app through Capacitor.

## Implemented Features

- Tabbed dashboard for Home, Map, Alerts, and Profile views
- Live and cached environmental telemetry
- Flood, air, water, and earthquake risk evaluation
- Hazard zones and road-closure visualization
- Offline map and route data cached locally
- Safe-place recommendations and route safety scoring
- Browser/device GPS support through Capacitor Geolocation
- Local WebSocket updates from a telemetry backend
- Supabase synchronization and realtime updates when configured
- PWA support and Android/Capacitor project files
- Renode simulation assets and a serial-to-backend telemetry bridge
- SOS sharing/copy actions and a disaster monitoring hub
- Demo authentication backed by browser local storage

## Technology Stack

### Application

- React 19
- TanStack Start and TanStack Router
- TypeScript
- Vite 8
- Tailwind CSS
- Radix UI and Recharts
- PWA plugin

### Platform and Data

- Capacitor 8 for Android
- Supabase for optional cloud dataset and realtime telemetry
- Browser storage for cached datasets and profile data
- WebSocket and HTTP connections for local telemetry
- Local backend/SQLite pipeline in a separate environment

### Simulation

- Renode
- STM32/Zephyr platform files
- Python serial bridge

## Repository Structure

```text
EnviroShield_AI/
├── android/                 # Generated Android/Capacitor project
├── public/                  # Icons, manifest, logo, login page
├── renode/                  # Renode platform and simulation files
├── src/
│   ├── components/          # Dashboard, map, alert, and UI components
│   ├── data/                # Bundled Peddapuram map and city data
│   ├── integrations/
│   │   └── supabase/        # Supabase client and authentication helpers
│   ├── lib/                 # Routing, sync, telemetry, cache, and risk logic
│   ├── routes/              # TanStack route components
│   ├── router.tsx
│   ├── server.ts
│   └── styles.css
├── supabase/
│   └── migrations/          # Database schema migrations
├── work/                    # Saved map and bridge status data
├── .env.example             # Local environment variable template
├── capacitor.config.ts
├── package.json
└── vite.config.ts
```

## Risk and Routing Logic

The application uses a local rule-based engine rather than a downloaded machine-learning model.

- `src/lib/ai-monitor.ts` evaluates available telemetry and data quality.
- `src/lib/intelligence.ts` merges live closures and ranks safe destinations.
- `src/lib/routing.ts` calculates routes over the bundled road graph.
- `src/lib/sync.ts` synchronizes or caches disaster datasets.
- `src/lib/local-cache.ts` stores offline data locally.
- `src/lib/forest-fire.ts` provides forest-fire telemetry processing.

The risk results are designed to support demonstrations and local monitoring. They should not replace official emergency alerts or public safety guidance.

## Getting Started

The repository is the app directory when it is opened as a project. Run the application from the directory containing `package.json`.

### Prerequisites

- Node.js 20 or newer
- npm
- Android Studio for Android builds
- Optional: a local telemetry backend on port `3001`
- Optional: a configured Supabase project

### Install and Run

```bash
cd EnviroShield_AI
npm install
npm run dev
```

Open the URL printed by Vite. The app redirects unauthenticated users to `public/login.html`.

### Production Build

```bash
npm run build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and provide values from your environment:

```bash
cp .env.example .env
```

Environment variables must use the names shown in `.env.example`. Never commit `.env` or private service-role credentials.

Supabase publishable keys are browser-accessible configuration values, not server secrets. Any privileged database operations must use server-only environment variables and enforce Row-Level Security.

## Authentication Note

The current login flow is a demonstration. It stores an authentication flag in `localStorage` and has not been implemented as a production identity provider.

Before deploying publicly, authentication should be replaced or extended with:

- Server-validated sessions
- Supabase Auth or another identity provider
- Secure session storage
- Authorization checks in database policies
- Proper logout and account recovery flows

## Live Telemetry

The dashboard attempts to retrieve telemetry in this order:

1. Local HTTP backend at `localhost:3001`
2. Supabase `sensor_telemetry` table
3. Cached/offline application data

On Android/Capacitor, the local backend address is translated to `10.0.2.2:3001` for the emulator or supported device network configuration.

The app also opens a local WebSocket connection and listens for:

- `telemetry_update`
- `alert_new`

When Supabase is available, it can receive realtime inserts and updates from `sensor_telemetry`.

## Android Build

```bash
npm run build
npx cap sync android
npx cap open android
```

To run directly from a configured Android environment:

```bash
npx cap run android
```

## Renode Pipeline

The repository includes Renode and Zephyr-related assets for simulation. The run procedure and verified test values are documented in `RUNBOOK.md`.

A separate local backend, serial bridge, and Renode configuration are required for the complete hardware/simulation pipeline.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production build |
| `npm run preview` | Preview the built application |
| `npm run lint` | Run ESLint |
| `npm run format` | Format project files with Prettier |

## Testing

A telemetry-risk unit test is included:

```bash
npm run lint
node --test src/lib/telemetry-risk.test.ts
```

The existing `RUNBOOK.md` also contains a live Renode-to-application verification procedure.

## Documentation

- `README.md` — Project overview and setup
- `RUNBOOK.md` — Verified live telemetry pipeline commands
- `INTEGRATION.md` — Login and FloodSafe integration behavior
- `supabase/migrations/` — Supabase database schema

## Security

- Do not commit `.env` files or private keys
- Keep service-role keys on trusted server environments only
- Protect Supabase tables with appropriate Row-Level Security policies
- Replace demo credentials before public deployment
- Regenerate any API keys that have already been committed

## Team

**Team:** FRIENDS

The repository is maintained for educational, research, and environmental-awareness demonstration purposes.
