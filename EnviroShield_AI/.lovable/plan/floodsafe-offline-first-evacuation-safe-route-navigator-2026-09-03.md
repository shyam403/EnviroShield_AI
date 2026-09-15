# FloodSafe — Offline-First Evacuation & Safe Route Navigator

An installable offline-first web app (PWA) for flood evacuation: offline map, flood risk zones, safest-route navigation, and an emergency mode that keeps working with no network.

Native Android is not buildable here, so this ships as an installable mobile web app. It can later be wrapped for Play Store distribution if you want.

## What gets built (core navigation first)

### Offline map surface
- Custom vector map rendered from a bundled demo city dataset: roads, bridges, buildings, landmarks, hospitals, schools, police stations, shelters, relief centers, evacuation centers, safe zones.
- Pan, pinch/wheel zoom anchored under the cursor, tap-to-inspect any place.
- Zone overlays: red (high risk / flooded / low-lying / near river), yellow (moderate, caution), green (safer, elevated, shelters).
- Persistent OFFLINE MODE banner when connectivity drops.
- Everything renders from local data — no tile server, no network needed.

### Location handling (honest about GPS)
- Uses device GPS when available; caches last known position.
- If no signal: shows "Location signal unavailable", keeps the map live, shows last known point greyed with its timestamp.
- Manual location pin: user taps the map to set their position, and can route from that point.
- Never claims a precise fix the device didn't provide.

### Safe route navigation
- Offline routing over the local road graph using a cost function, not shortest path:
  - red-zone and flooded/unsafe road segments are heavily penalized or excluded
  - unsafe bridges excluded
  - green zones, elevated roads, and designated evacuation routes discounted
- Returns up to 3 candidate routes ranked by safety first, distance second.
- Each route shows: safety score + level (Safe / Caution / Dangerous), distance, walking time, number of dangerous sections, and which hazards it passes.
- Live warning if the active route crosses into a red zone, with one-tap recalculate.

### Local intelligence layer
- On-device rule engine scores zones and route segments, recommends nearest safe destinations, and detects hazard entry — deterministic, works offline, no model download.
- Pluggable scoring interface so a learned model can replace the rules later without touching the UI.

### Offline search
- Instant local search plus quick chips: Nearest shelter, Hospital, Police station, Relief center, Safe zone, Higher ground. Results sorted by safe-route distance.

### Emergency mode
- Full-width EMERGENCY MODE button.
- Activates a high-contrast, low-motion screen: your location, nearest shelters and safe zones, safest route, hospitals and emergency services, and step-by-step safety instructions.
- Animations disabled to save battery.

### Data freshness & sync (Cloud)
- Cloud database holds hazard zones, shelters and their availability, alerts, and road closures.
- On connect: pull latest, store locally, stamp with last-updated time, source, and freshness (Live / Recent / Stale).
- Offline: keep serving the last synced dataset, clearly labeled as not live.

### SOS (honest fallback)
- Online: share location and send an emergency message record.
- Offline: shows "Network unavailable" — no fake send — and offers offline instructions plus device SMS / share-sheet handoff where supported.

## Design direction
High-contrast dark disaster-ops interface: near-black slate base, safety amber accents, and only red/yellow/green reserved for hazard meaning. Large touch targets, condensed technical type, map-first layout with a bottom sheet for search, routes, and status. All colors as semantic tokens.

## Technical notes
- TanStack Start + React, Tailwind v4 semantic tokens.
- Map is an SVG/canvas renderer over local GeoJSON-like data in `src/data/` — no Mapbox/Leaflet, so it works with zero network.
- Routing: A* with a hazard-weighted cost function in `src/lib/routing/`.
- Local persistence in IndexedDB (map dataset, last sync, last known location, manual pin).
- Offline shell via `vite-plugin-pwa` (`generateSW`, NetworkFirst navigations), with registration guarded so it never runs in the Lovable preview — offline behavior is verifiable only in the published app.
- Lovable Cloud enabled for hazard/shelter/alert tables with RLS + public read policies; sync is a read-only pull.

## Out of scope for this pass
Real OSM tile downloads per region, Bluetooth/Wi-Fi Direct mesh messaging, and a trained ML model — the architecture leaves clean seams for all three.
