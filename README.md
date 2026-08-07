<img width="3439" height="1324" alt="image" src="https://github.com/user-attachments/assets/7a1ce02b-cdef-4798-92fc-942788287ffb" />

<img width="3439" height="1326" alt="image" src="https://github.com/user-attachments/assets/9d90889a-121c-43eb-a8bc-6b21b88294dc" />

# AURORA
## Real-Time Space Situational Awareness Platform

![Status](https://img.shields.io/badge/status-in%20development-cyan?style=for-the-badge)
![Rust](https://img.shields.io/badge/Rust-engine-orange?style=for-the-badge&logo=rust)
![Go](https://img.shields.io/badge/Go-ingestion%20and%20gateway-00ADD8?style=for-the-badge&logo=go)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-streaming-231F20?style=for-the-badge&logo=apache-kafka)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![CesiumJS](https://img.shields.io/badge/CesiumJS-3D%20globe-6CADDF?style=for-the-badge)

AURORA is a real-time space situational awareness dashboard that combines live orbital data, conjunction alerts, and space weather inside a Cesium-based 3D UI.

Current backend split:

- `backend/engine-rust/` is the primary orbital propagation service.
- `backend/gateway/` and `backend/ingestion/*` are still Go services.
- `backend/engine/` is the older Go propagation engine kept in the repo as a fallback/reference path.

## Stack

### Frontend
- React 18
- TypeScript
- Vite
- CesiumJS
- Zustand

### Backend
- Rust orbital engine (`rdkafka`, `sgp4`, `tokio`, Prometheus)
- Go gateway (`gorilla/websocket`)
- Go ingestion services for CelesTrak, NOAA, and Space-Track
- Apache Kafka
- Prometheus + Grafana
- Docker Compose for local infra

## Data Sources

| Source | Purpose | Required |
| --- | --- | --- |
| CelesTrak | TLEs for satellite propagation | Yes |
| NOAA SWPC | Space weather feed | Yes |
| Space-Track | Conjunction/CDM feed | Optional |

## Space Weather Scales

The space weather utilities model all three of NOAA SWPC's
[space weather scales](https://www.swpc.noaa.gov/noaa-scales-explanation) in
`frontend/src/utils/spaceWeatherScales.ts`. The Space Weather panel currently surfaces the
G and R scales; the S scale helpers are ready for the panel to consume once a proton-flux
reading is added to the feed:

| Scale | Driver | Levels | Helpers |
| --- | --- | --- | --- |
| G (geomagnetic storm) | Planetary Kp index | G1–G5 | `kpToGScale`, `kpToGScaleInfo`, `gScaleColor` |
| R (radio blackout) | Peak GOES X-ray flux | R1–R5 | `xrayClassToRScale`, `xrayClassToRScaleInfo`, `rScaleColor` |
| S (solar radiation storm) | Peak ≥10 MeV proton flux (pfu) | S1–S5 | `protonFluxToSScale`, `protonFluxToSScaleInfo`, `sScaleColor` |

Each scale exposes a metadata table (`geomagneticStormScale` / `radioBlackoutScale` /
`solarRadiationStormScale`) with a severity code, short label, and one-line operational impact,
plus a colour map that escalates from quiet green to extreme red. `G0`/`R0`/`S0` denote
sub-storm quiet conditions.

## Orbit Summary

Derived orbital characteristics for a satellite come from the pure helpers in
`frontend/src/utils/orbitSummary.ts`, which build on the orbital-mechanics primitives in
`frontend/src/utils/orbit.ts`:

| Helper | Returns |
| --- | --- |
| `getOrbitalPeriodMinutes` | Orbital period in minutes |
| `getRevolutionsPerDay` | Revolutions completed per 24-hour solar day (mean motion) |
| `getGroundTrackShiftDegrees` | Westward ground-track longitude shift per orbit |
| `describeOrbitRegime` | Regime label, altitude band, and usage note for LEO/MEO/GEO |
| `summarizeOrbit` | All of the above plus circular orbital velocity in one struct |

Circular orbital speed comes from `circularOrbitalVelocityKms` in `orbit.ts` (the vis-viva
relation `v = sqrt(mu / r)`), and `formatOrbitalPeriod` in `frontend/src/utils/format.ts`
renders a period in minutes as a compact `Hh Mm` (or bare `Mm`) string. All values are derived
from the same deterministic orbit radius so they stay mutually consistent.

## Catalog Statistics

Summary figures for the whole tracked catalog come from the pure helpers in
`frontend/src/utils/catalogStats.ts`, which aggregate over a `Satellite[]`:

| Helper | Returns |
| --- | --- |
| `countByOrbitType` | Object counts per LEO/MEO/GEO regime |
| `countByRiskLevel` | Object counts per nominal/watch/warning/critical level |
| `averageAltitudeKm` | Mean catalog altitude in kilometres |
| `averageVelocityKms` | Mean catalog velocity in kilometres per second |
| `totalConjunctions` | Sum of per-object active conjunction counts |
| `countElevatedRisk` | Objects at or above a given risk threshold (default `watch`) |
| `summarizeCatalog` | All of the above bundled into one `CatalogSummary` struct |

The breakdown helpers always return every regime or risk level (defaulting to zero), and the
averages return `0` rather than `NaN` for an empty catalog, so summary displays render a stable
set of rows regardless of the catalog contents.

## Catalog Filtering and Search

Common catalog queries are collected as pure, non-mutating helpers in
`frontend/src/utils/catalogFilters.ts`, so panels no longer re-implement the same
`Satellite[]` filters inline:

| Helper | Returns |
| --- | --- |
| `filterByOrbitType` | Satellites in one LEO/MEO/GEO regime |
| `filterByRiskLevel` | Satellites carrying exactly one risk level |
| `filterByOwner` | Satellites for an owner (case-insensitive, whitespace-trimmed) |
| `filterByAltitudeRange` | Satellites within an inclusive altitude band |
| `searchCatalog` | Free-text match on name or NORAD id |
| `filterElevatedRisk` | Satellites at or above a risk threshold (default `watch`) |
| `sortByAltitudeDesc` | Satellites ordered highest-to-lowest altitude |
| `sortByConjunctionCountDesc` | Satellites ordered by most active conjunctions |

Every helper returns a new array and never mutates its input, so the results are safe to
derive directly from store state. `filterByAltitudeRange` normalises swapped bounds,
`searchCatalog` returns a copy of the catalog for a blank query, and `filterElevatedRisk`
reuses the same `RISK_LEVELS` ordering as `countElevatedRisk` in `catalogStats` so the list
and the count never disagree.

## Conjunction Risk Tiers

Conjunction warnings are ranked by collision probability into four risk tiers, defined once in
`frontend/src/utils/conjunctionRisk.ts` and shared by the globe overlays and every conjunction
panel so the boundaries never drift apart:

| Tier | Collision probability | Operational meaning |
| --- | --- | --- |
| `critical` | > 1e-3 | Maneuver recommended |
| `warning` | > 1e-4 | Monitoring required |
| `watch` | > 1e-6 | Track, no action yet |
| `nominal` | ≤ 1e-6 | No action required |

`classifyConjunctionRisk` maps a probability to its tier, and `isActionableConjunctionRisk`
reports whether it reaches the `warning` band or higher. Thresholds live in the exported
`CONJUNCTION_RISK_THRESHOLDS` constant.

`classifyConjunctionFleetSeverity` collapses a whole fleet of conjunctions into a single
`critical | warning | elevated | clear` severity — `critical` when any conjunction is
individually critical (see `isCriticalConjunction`), `warning` when any remaining conjunction is
actionable by probability, `elevated` when conjunctions are tracked but none reach those tiers,
and `clear` for an empty fleet. The ops warning badge derives its colour from this severity via
`conjunctionFleetSeverityColor` in `frontend/src/utils/colors.ts`, so the escalation logic lives
in one place instead of being re-derived inline.

The remaining conjunction presentation helpers are shared the same way: `conjunctionRowTextClass`
(`colors.ts`) returns the Tailwind text-colour class used to shade each row of the active
conjunctions table by risk level, and `formatConjunctionWarningLabel` (`format.ts`) builds the
pluralised badge label (for example `1 ACTIVE CONJUNCTION WARNING` versus
`3 ACTIVE CONJUNCTION WARNINGS`).

## Storm Impact Panel Helpers

The Storm Impact panel derives its at-risk asset tally and its Kp-history sparkline from two pure
utility modules rather than inline component logic, so both are unit-tested independently of React.

`frontend/src/utils/stormExposure.ts` counts, in a single pass over a `Satellite[]`, how many
objects fall into each geomagnetic-storm exposure bucket. The buckets overlap by design — one
object can land in more than one — because each reflects a hazard operators track separately:

| Bucket | Criterion | Hazard |
| --- | --- | --- |
| `leoDrag` | Altitude below 2000 km | Increased atmospheric drag |
| `geoCharging` | Altitude above 35000 km | Surface charging near GEO |
| `debris` | Owner is `DEBRIS` | Accelerated orbital decay |

The thresholds live in the exported `STORM_EXPOSURE_THRESHOLDS` constant, and objects exactly on a
boundary are excluded (the comparisons are strict).

`frontend/src/utils/sparkline.ts` turns a numeric series into SVG sparkline geometry. The SVG
y-axis grows downward, so the series minimum sits at the bottom edge and the maximum at the top;
values outside the configured `[min, max]` range are clamped into the drawing area:

| Helper | Returns |
| --- | --- |
| `sparklineY` | Vertical pixel position for a single value |
| `sparklinePoints` | Evenly spaced `{ x, y, value }` points across the width |
| `sparklinePath` | An SVG `path` `d` string linking the points |
| `buildSparkline` | Points and path in one pass |
| `sparklineThresholdY` | Vertical position of a horizontal reference line |

## Repo Layout

```text
Aurora_Space/
|- frontend/                 React + TypeScript + Cesium app
|- backend/
|  |- gateway/               Go WebSocket gateway
|  |- ingestion/
|  |  |- celestrak/          Go TLE ingestion service
|  |  |- noaa/               Go space weather ingestion service
|  |  `- spacetrack/         Go conjunction ingestion service
|  |- engine-rust/           Primary Rust propagation engine
|  |- engine/                Legacy Go propagation engine
|  |- shared/                Shared Go Kafka/types helpers
|  |- bin/                   Built local binaries
|  `- .env.example           Backend env template
`- infra/
   |- docker-compose.yml     Kafka, Zookeeper, Prometheus, Grafana
   `- prometheus/            Prometheus scrape config
```

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 18+ |
| npm | current Node LTS |
| Go | 1.21+ |
| Rust | stable |
| Docker Desktop | recent |
| Git | recent |

If you want to build the Rust engine on Windows, you also need:

- the Rust target `x86_64-pc-windows-gnu`
- MinGW-w64 `gcc`
- CMake

The current [backend/engine-rust/.cargo/config.toml](C:/Users/sripa/OneDrive/Documents/GitHub/Aurora_Space/backend/engine-rust/.cargo/config.toml) and [backend/Makefile](C:/Users/sripa/OneDrive/Documents/GitHub/Aurora_Space/backend/Makefile) use local Windows paths for `gcc` and `cmake`. Update those paths if your install lives somewhere else.

## Environment Setup

### Frontend

Copy [frontend/.env.example](C:/Users/sripa/OneDrive/Documents/GitHub/Aurora_Space/frontend/.env.example) to `frontend/.env`.

```env
VITE_CESIUM_ION_TOKEN=your_real_cesium_ion_token
VITE_NASA_API_KEY=
VITE_SPACETRACK_USERNAME=
VITE_SPACETRACK_PASSWORD=
VITE_WS_URL=ws://localhost:8080/ws
```

Notes:

- `VITE_CESIUM_ION_TOKEN` is required.
- `VITE_WS_URL` is optional. If the backend is not running, the frontend still boots with mock data.
- The frontend env currently includes Space-Track values, but the live conjunction ingestion is handled by the backend service.

### Backend

Copy [backend/.env.example](C:/Users/sripa/OneDrive/Documents/GitHub/Aurora_Space/backend/.env.example) to `backend/.env`.

```env
KAFKA_BROKERS=localhost:9092
SPACETRACK_USERNAME=
SPACETRACK_PASSWORD=
METRICS_PORT_GATEWAY=2112
METRICS_PORT_NOAA=2113
METRICS_PORT_ENGINE=2114
METRICS_PORT_ENGINE_RUST=2117
METRICS_PORT_CELESTRAK=2115
METRICS_PORT_SPACETRACK=2116
WS_PORT=8080
```

Notes:

- `SPACETRACK_USERNAME` and `SPACETRACK_PASSWORD` are only needed if you run the Space-Track ingestion service.
- The Rust engine reads `METRICS_PORT_ENGINE_RUST` and falls back to `METRICS_PORT`.
- The legacy Go engine reads `METRICS_PORT_ENGINE`.

## Quick Start

### 1. Clone the repo

```powershell
git clone https://github.com/sripadsirik/Aurora_Space.git
cd Aurora_Space
```

### 2. Start the frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Set a real `VITE_CESIUM_ION_TOKEN` in `frontend/.env`, then run:

```powershell
npm run dev
```

Frontend URL:

- `http://localhost:5173`

This works immediately with mock data. Live data appears once the backend WebSocket is available.

### 3. Start infrastructure

```powershell
cd ..\infra
docker compose up -d
```

Local infra URLs:

- Kafka: `localhost:9092`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

Grafana anonymous access is enabled. If you need admin access, use `admin / aurora`.

### 4. Prepare backend env

```powershell
cd ..\backend
Copy-Item .env.example .env
```

Add `METRICS_PORT_ENGINE_RUST=2117` to `backend/.env` if it is not already there.

### 5. Build the Go services

From `backend/`:

```powershell
go build -o .\bin\gateway.exe .\gateway
go build -o .\bin\celestrak.exe .\ingestion\celestrak
go build -o .\bin\noaa.exe .\ingestion\noaa
go build -o .\bin\spacetrack.exe .\ingestion\spacetrack
```

### 6. Build the Rust engine

From `backend/`:

```powershell
cd engine-rust
rustup target add x86_64-pc-windows-gnu
cargo build --release
Copy-Item .\target\x86_64-pc-windows-gnu\release\engine-rust.exe ..\bin\engine-rust.exe
cd ..
```

If you already have `make` and your local paths match the repo config, you can also use:

```powershell
make engine-rust
```

### 7. Run the live stack

Use separate terminals, all from `backend/`.

Terminal 1 - gateway

```powershell
cd backend
.\bin\gateway.exe
```

Terminal 2 - CelesTrak ingestion

```powershell
cd backend
.\bin\celestrak.exe
```

Terminal 3 - NOAA ingestion

```powershell
cd backend
.\bin\noaa.exe
```

Terminal 4 - Rust engine

```powershell
cd backend
$env:METRICS_PORT_ENGINE_RUST="2117"
.\bin\engine-rust.exe
```

Terminal 5 - Space-Track ingestion (optional)

```powershell
cd backend
.\bin\spacetrack.exe
```

Recommended startup order for live data:

```text
docker compose -> gateway -> celestrak -> noaa -> engine-rust -> spacetrack -> frontend
```

The frontend can be started earlier, but that order gives the live feeds time to populate.

## Fastest Dev Loop

If you only want to work on the UI:

1. Start the frontend.
2. Set a valid Cesium Ion token.
3. Skip Kafka and backend services.

The app boots with mock satellites, conjunctions, and space weather until `VITE_WS_URL` connects.

## Frontend Tests

The frontend uses [Vitest](https://vitest.dev/) for unit tests, currently covering the
pure utility modules (`format`, `env`, `colors`, `orbit`, `orbitSummary`, `catalogStats`,
`catalogFilters`, `helio`, `spaceWeatherScales`, `conjunctionRisk`, `stormExposure`, `sparkline`), the Zustand store, and the mock datasets under `src/data/mock/`
(satellite catalog, conjunctions, CME library, historical events, and the space weather
snapshot).

```powershell
cd frontend
npm install
npm test          # run once
npm run test:watch  # re-run on change
```

Tests live alongside the code they exercise in `__tests__/` directories and run in a
Node environment with Cesium available through `vite-plugin-cesium`.

## Backend Services

| Service | Path | Runtime | Default Port |
| --- | --- | --- | --- |
| Gateway | `backend/gateway/` | Go | `8080` WebSocket, `2112` metrics |
| CelesTrak ingestion | `backend/ingestion/celestrak/` | Go | `2115` metrics |
| NOAA ingestion | `backend/ingestion/noaa/` | Go | `2113` metrics |
| Space-Track ingestion | `backend/ingestion/spacetrack/` | Go | `2116` metrics |
| Rust engine | `backend/engine-rust/` | Rust | `2114` metrics |
| Legacy Go engine | `backend/engine/` | Go | `2114` metrics |

## Kafka Topics

| Topic | Producer | Consumer |
| --- | --- | --- |
| `aurora.satellites.tle` | CelesTrak ingestion | Rust engine / Go engine |
| `aurora.satellites.positions` | Rust engine / Go engine | Gateway |
| `aurora.conjunctions.raw` | Space-Track ingestion | internal processing |
| `aurora.conjunctions.alerts` | Space-Track ingestion | Gateway |
| `aurora.spaceweather.raw` | NOAA ingestion | internal processing |
| `aurora.spaceweather.processed` | NOAA ingestion | Gateway |

## Useful URLs

- Frontend: `http://localhost:5173`
- WebSocket: `ws://localhost:8080/ws`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## Current Notes

- The README now documents the Rust engine as the default propagation path.
- The old Go engine is still present in the repo but is not the recommended startup path.
- Rust engine builds on Windows depend on your local MinGW/CMake install paths.
- `backend/bin/` holds local binaries and should stay local-only.

## License

MIT
