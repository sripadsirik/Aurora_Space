<img width="3439" height="1324" alt="image" src="https://github.com/user-attachments/assets/7a1ce02b-cdef-4798-92fc-942788287ffb" />

<img width="3439" height="1326" alt="image" src="https://github.com/user-attachments/assets/9d90889a-121c-43eb-a8bc-6b21b88294dc" />


# AURORA
### Real-Time Space Situational Awareness Platform

> *"What happens when you build the backend that Palantir forgot, and the frontend that NASA wishes it had."*

![AURORA Dashboard](https://img.shields.io/badge/status-in%20development-cyan?style=for-the-badge)
![Go](https://img.shields.io/badge/Go-1.21-00ADD8?style=for-the-badge&logo=go)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=for-the-badge&logo=apache-kafka)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![CesiumJS](https://img.shields.io/badge/CesiumJS-3D%20Globe-6CADDF?style=for-the-badge)

---

## What Is AURORA?

AURORA is a production-grade, real-time space situational awareness dashboard that fuses live orbital mechanics, space weather, and satellite conjunction risk data into a single 3D intelligence interface.

It was built to answer the question the Palantir co-founder asked when WorldView went viral: *"Where's the real data fusion?"*

AURORA is that answer. It combines:

- A **Go orbital propagation engine** using SGP4 (`go-satellite`) to compute live satellite positions for 8,000+ objects in real time
- A **Go-based streaming ingestion layer** pulling from 3 public data sources simultaneously (CelesTrak, Space-Track, NOAA)
- An **Apache Kafka backbone** with 4 purpose-built topics routing data from ingestion → processing → visualization
- A **Prometheus + Grafana observability stack** monitoring the entire pipeline with custom space domain metrics
- A **CesiumJS 3D globe frontend** with mission-control aesthetics, 4 visual modes, and a solar system heliocentric view

This is not a demo. This is a distributed systems project with a jaw-dropping frontend.

---

## Live Data Sources (All Free)

| Source | Data | Update Frequency |
|--------|------|-----------------|
| [CelesTrak](https://celestrak.org) | TLE orbital elements for all active satellites | Every 2 hours |
| [Space-Track.org](https://space-track.org) | Conjunction Data Messages (CDMs) — US Space Force collision warnings | Every 6 hours |
| [NOAA SWPC](https://swpc.noaa.gov) | Solar wind speed, density, Bz component, Kp index, X-ray flux | Every 1-3 minutes |

---

## Tech Stack

### Backend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Ingestion | **Go 1.21** | 3 concurrent data source connectors (CelesTrak, Space-Track, NOAA) |
| Stream Bus | **Apache Kafka** | 4 topics routing all data flows |
| Orbital Engine | **Go (`go-satellite`)** | SGP4 propagation, satellite position computation every 30s |
| API Gateway | **Go (`gorilla/websocket`)** | WebSocket server, frontend bridge |
| Observability | **Prometheus + Grafana** | Pipeline health + space environment dashboards |
| Infrastructure | **Docker Compose** | Kafka, Zookeeper, Prometheus, Grafana |

### Frontend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **React 18 + TypeScript + Vite** | Component architecture |
| 3D Globe | **CesiumJS** | Photorealistic Earth, orbital rendering |
| State | **Zustand** | Global app state management |
| Styling | **Tailwind CSS** | HUD panels and UI components |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
│         CelesTrak          Space-Track          NOAA SWPC        │
└──────────┬──────────────────────┬────────────────────┬──────────┘
           │                      │                    │
           ▼                      ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GO INGESTION SERVICES                          │
│          celestrak/         spacetrack/         noaa/            │
│                                                                  │
│   Each service: fetch → normalize → produce to Kafka topic       │
│   Metrics exposed on /metrics for Prometheus scraping            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APACHE KAFKA                                │
│                                                                  │
│   aurora.satellites.tle          (raw TLE strings)               │
│   aurora.satellites.positions    (propagated lat/lon/alt)        │
│   aurora.conjunctions.alerts     (processed CDM risk alerts)     │
│   aurora.spaceweather.processed  (normalized Kp/Bz/wind)        │
└───────────┬──────────────────────────────┬──────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────┐      ┌───────────────────────────────────┐
│   GO ENGINE           │      │   GO GATEWAY                      │
│                       │      │                                   │
│ • SGP4 propagation    │      │ • Consumes all processed topics   │
│ • 8,000+ satellites   │      │ • WebSocket server (:8080)        │
│ • Position batching   │      │ • Broadcasts to frontend clients  │
│ • 30s update cycle    │      │ • State snapshot on connect       │
└───────────────────────┘      └──────────────┬────────────────────┘
                                              │  WebSocket
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (CesiumJS + React)                   │
│                                                                  │
│   3D Globe  ·  HUD Overlays  ·  4 Visual Modes  ·  Panels       │
│   Satellite Layer  ·  Aurora Ovals  ·  Solar Wind Particles      │
│   Conjunction Threads  ·  Helio View  ·  Timeline Scrubber       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Services

| Service | Directory | Metrics Port | Description |
|---------|-----------|-------------|-------------|
| **Gateway** | `backend/gateway/` | `:2112` | WebSocket server on `:8080`, bridges Kafka → frontend |
| **Engine** | `backend/engine/` | `:2114` | SGP4 orbital propagation, consumes TLEs, produces positions every 30s |
| **CelesTrak Ingestion** | `backend/ingestion/celestrak/` | `:2115` | Fetches satellite TLE catalog every 2 hours |
| **NOAA Ingestion** | `backend/ingestion/noaa/` | `:2113` | Fetches Kp index, solar wind, Bz, X-ray flux every 1-3 min |
| **Space-Track Ingestion** | `backend/ingestion/spacetrack/` | `:2116` | Fetches CDM conjunction data every 6 hours (requires Space-Track account) |

All services are **Go** and share types + Kafka wrapper from `backend/shared/`.

---

## Kafka Topics

| Topic | Producer | Consumer | Description |
|-------|----------|----------|-------------|
| `aurora.satellites.tle` | CelesTrak ingestion | Engine | Raw Three-Line Element sets |
| `aurora.satellites.positions` | Engine | Gateway | Propagated lat/lon/alt batches every 30s |
| `aurora.conjunctions.alerts` | Space-Track ingestion | Gateway | Processed conjunction warnings with collision probability |
| `aurora.spaceweather.processed` | NOAA ingestion | Gateway | Normalized space weather state (Kp, Bz, solar wind) |

---

## Prometheus Metrics

Every Go service exposes `/metrics` for Prometheus scraping:

```
aurora_kafka_messages_produced_total     # counter, per topic
aurora_spacetrack_fetch_errors_total     # counter
aurora_conjunctions_active               # gauge
aurora_satellites_tracked                # gauge
aurora_kp_index_current                  # gauge
aurora_engine_propagation_latency_ms     # histogram
```

Grafana dashboards are auto-provisioned at `http://localhost:3001`:
- **AURORA Pipeline Health** — throughput, latency, error rates per service
- **Space Environment** — live Kp index, solar wind speed, conjunction count over time

---

## Frontend Visual Modes

AURORA has 4 distinct visual modes toggled with keyboard shortcuts `1` `2` `3` `4`:

### 1. OPS Mode (default)
Clean dark professional UI. Deep navy background, cyan accents, white labels. The Palantir-lite face. This is what you show at an interview.

### 2. STORM Mode
Triggered automatically when Kp > 5 or manually. The globe takes on a deep red-orange atmospheric glow, aurora ovals expand toward the equator, solar wind particles turn blood red, and a "GEOMAGNETIC STORM ACTIVE" banner fires. This is the screenshot that goes viral.

### 3. INTEL Mode
Full CRT aesthetic: scanlines, phosphor green monochrome tint, screen flicker, barrel distortion. A fake "TOP SECRET // SPACE SITUATIONAL AWARENESS // NOFORN" classification banner sits at the top. Satellite labels switch to NORAD IDs. This is the WorldView competitor.

### 4. HELIO Mode
Zoom out to the inner solar system. The Sun sits at center, Earth's orbital path is traced, and a live CME propagation cone animates from the Sun toward Earth with an arrival countdown. The DSCOVR satellite at L1 is marked as the early warning sensor. Nothing like this exists in any open-source space tool.

---

## Frontend Data Layers

| Layer | Source | What It Shows |
|-------|--------|---------------|
| Satellites | CelesTrak → Engine | 8,000+ objects, color-coded by conjunction risk |
| Conjunction Threads | Space-Track CDMs | Glowing lines connecting high-risk pairs |
| Aurora Ovals | Derived from Kp | Live polar aurora forecast, expands with Kp |
| Magnetosphere Shell | Derived from solar wind | Translucent ellipsoid, pulses with storm intensity |
| Solar Wind Particles | NOAA DSCOVR | Animated particle stream from sun direction |
| Space Weather HUD | NOAA SWPC | Live Kp, Bz, solar wind speed/density |
| CME Propagation | Simulated | Expanding cone in Helio mode with arrival countdown |

---

## Project Structure

```
aurora_space/
├── frontend/                    # React + TypeScript + CesiumJS
│   ├── src/
│   │   ├── components/
│   │   │   ├── GlobeView.tsx    # CesiumJS globe, all visual layers (~1900 lines)
│   │   │   ├── HUD.tsx          # Overlay panels, alerts ticker
│   │   │   ├── ModeSelector.tsx # OPS/STORM/INTEL/HELIO mode switcher
│   │   │   ├── Timeline.tsx     # Historical event timeline scrubber
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── overlays/        # STORM, INTEL, HELIO overlay effects
│   │   │   └── panels/          # Satellite, conjunction, weather panels
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts  # WebSocket connection to Go gateway
│   │   ├── store/
│   │   │   └── auroraStore.ts   # Zustand global state
│   │   ├── types/
│   │   │   └── space.ts         # TypeScript interfaces (Satellite, ConjunctionWarning, etc.)
│   │   ├── utils/               # Colors, orbit math, formatting, helio helpers
│   │   └── data/mock/           # Mock data for offline development
│   ├── .env.example
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── gateway/
│   │   └── main.go              # WebSocket server, Kafka consumer, state broadcast
│   ├── engine/
│   │   └── main.go              # SGP4 propagation using go-satellite
│   ├── ingestion/
│   │   ├── celestrak/
│   │   │   └── main.go          # TLE fetcher → Kafka producer
│   │   ├── spacetrack/
│   │   │   └── main.go          # CDM fetcher → Kafka producer (Space-Track auth)
│   │   └── noaa/
│   │       └── main.go          # Space weather → Kafka producer
│   ├── shared/
│   │   ├── types.go             # Shared Go types (Satellite, ConjunctionWarning, SpaceWeather)
│   │   └── kafka.go             # Kafka producer/consumer wrapper
│   ├── bin/                     # Compiled service binaries
│   ├── go.mod
│   ├── go.sum
│   ├── .env
│   └── .env.example
│
└── infra/
    ├── docker-compose.yml       # Kafka + Zookeeper + Prometheus + Grafana
    └── prometheus/
        └── prometheus.yml       # Scrape config for all Go services
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Go | 1.21+ | [golang.org/dl](https://golang.org/dl) |
| Docker Desktop | 24+ | [docker.com](https://docker.com/products/docker-desktop) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

---

## Environment Variables

### Frontend

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_CESIUM_ION_TOKEN=        # ion.cesium.com (free account)
VITE_NASA_API_KEY=             # api.nasa.gov (free, instant)
VITE_SPACETRACK_USERNAME=      # space-track.org (free account)
VITE_SPACETRACK_PASSWORD=      # space-track.org password
VITE_WS_URL=ws://localhost:8080/ws
```

### Backend

Copy `backend/.env.example` to `backend/.env`:

```env
KAFKA_BROKERS=localhost:9092
SPACETRACK_USERNAME=           # space-track.org login
SPACETRACK_PASSWORD=           # space-track.org password
METRICS_PORT_GATEWAY=2112
METRICS_PORT_NOAA=2113
METRICS_PORT_ENGINE=2114
METRICS_PORT_CELESTRAK=2115
METRICS_PORT_SPACETRACK=2116
WS_PORT=8080
```

All keys are free. No paid APIs.

---

## Getting Started

### 1. Clone the repo

```powershell
git clone https://github.com/sripadsirik/aurora_space.git
cd aurora_space
```

### 2. Start the frontend (works standalone with mock data)

```powershell
cd frontend
npm install
copy .env.example .env
# Fill in your Cesium Ion token in .env
npm run dev
```

Frontend runs at `http://localhost:5173`. It works immediately with built-in mock data — no backend required for development.

### 3. Start infrastructure (Kafka + Prometheus + Grafana)

```powershell
cd infra
docker compose up -d
```

| Service | URL |
|---------|-----|
| Kafka | `localhost:9092` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3001` (admin/admin) |

### 4. Build the backend

```powershell
cd backend
go build -o .\bin\gateway.exe .\gateway
go build -o .\bin\engine.exe .\engine
go build -o .\bin\noaa.exe .\ingestion\noaa
go build -o .\bin\celestrak.exe .\ingestion\celestrak
go build -o .\bin\spacetrack.exe .\ingestion\spacetrack
```

Or run directly with `go run .` from each service directory.

### 5. Start the backend services

Open separate terminals for each service. Start them in this order:

**Terminal 1 — Gateway** (must start first, serves WebSocket to frontend)
```powershell
cd backend
.\bin\gateway.exe
```

**Terminal 2 — Engine** (SGP4 propagation, needs Kafka + TLE data)
```powershell
cd backend
.\bin\engine.exe
```

**Terminal 3 — CelesTrak Ingestion** (satellite TLEs)
```powershell
cd backend
.\bin\celestrak.exe
```

**Terminal 4 — NOAA Ingestion** (space weather)
```powershell
cd backend
.\bin\noaa.exe
```

**Terminal 5 — Space-Track Ingestion** (conjunction CDMs, optional)
```powershell
cd backend
$env:SPACETRACK_USERNAME="your@email.com"
$env:SPACETRACK_PASSWORD="your_password"
.\bin\spacetrack.exe
```

The frontend automatically switches from mock data to live data when the WebSocket connects.

### Startup Order

```
Docker (Kafka) → Gateway → Engine → CelesTrak → NOAA → Space-Track (optional)
```

The gateway must be running before ingestion services so it can consume from Kafka. The engine needs CelesTrak TLEs to propagate positions.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | OPS Mode (default) |
| `2` | STORM Mode |
| `3` | INTEL Mode (CRT aesthetic) |
| `4` | HELIO Mode (solar system view) |
| `0` | Earth-only mode (no HUD, slow rotation) |
| `Left drag` | Pan camera |
| `Right drag` | Orbit/rotate globe |
| `Scroll` | Zoom in/out |
| `Click satellite` | Open satellite detail panel |
| `Click alert` | Open conjunction detail panel |

---

## Why This Is Different From WorldView

WorldView (the viral "vibe-coded Palantir") is a frontend triumph with a backend vacuum. It polls public APIs directly from the browser, crashes when too many particles spawn, and has no data pipeline, no fault tolerance, no entity resolution, and no observability.

AURORA is what WorldView would look like if it had a real engineering team behind it:

| Feature | WorldView | AURORA |
|---------|-----------|--------|
| Data ingestion | Browser polling | Go services with retry/backoff |
| Stream processing | None | Apache Kafka, 4 topics |
| Orbital mechanics | None (static positions) | SGP4 engine (go-satellite) |
| Collision risk | Visual only | Real Pc calculation from CDMs |
| Observability | None | Prometheus + Grafana dashboards |
| Fault tolerance | "network error retry 9s" in UI | Per-service error handling + reconnect |
| Solar system view | None | Full heliocentric CME visualization |
| Timeline/playback | None | Historical event replay system |
| Production ready | No | Docker Compose with monitoring |

---

## Roadmap

- [x] Phase 1: Frontend globe foundation (CesiumJS, all visual layers, HUD)
- [x] Phase 2: Interactive panels (satellite detail, conjunction, space weather)
- [x] Phase 3: Visual modes (OPS, STORM, INTEL, HELIO) + timeline scrubber
- [x] Phase 4: Backend ingestion services (Go — CelesTrak, NOAA, Space-Track)
- [x] Phase 5: Go orbital engine (SGP4 propagation via go-satellite)
- [x] Phase 6: Go WebSocket gateway
- [x] Phase 7: Frontend ↔ backend integration (WebSocket replaces mock data)
- [ ] Phase 8: AWS deployment (MSK, ECS Fargate)
- [ ] Phase 9: Entity resolution (link satellites to operators, missions)
- [ ] Phase 10: Predictive storm impact modeling

---

## Credits & Data Attribution

- Orbital data: [CelesTrak](https://celestrak.org) — Dr. T.S. Kelso
- Conjunction data: [18th Space Defense Squadron](https://space-track.org) via Space-Track.org
- Space weather: [NOAA Space Weather Prediction Center](https://swpc.noaa.gov)
- Globe rendering: [CesiumJS](https://cesium.com) + Cesium ion

---

## License

MIT — build on it, fork it, show it off.

---

*Built by Sripapa — CS @ UIC + Georgia Tech M.S. CS or UIUC MCS (IDK which one to pick)*
*"If you've got domain expertise, this is the time to put it to work."*
