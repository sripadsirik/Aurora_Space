<img width="3439" height="1324" alt="image" src="https://github.com/user-attachments/assets/7a1ce02b-cdef-4798-92fc-942788287ffb" />


# AURORA
### Real-Time Space Situational Awareness Platform

> *"What happens when you build the backend that Palantir forgot, and the frontend that NASA wishes it had."*

![AURORA Dashboard](https://img.shields.io/badge/status-in%20development-cyan?style=for-the-badge)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=for-the-badge&logo=go)
![Rust](https://img.shields.io/badge/Rust-1.93-CE422B?style=for-the-badge&logo=rust)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=for-the-badge&logo=apache-kafka)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![CesiumJS](https://img.shields.io/badge/CesiumJS-3D%20Globe-6CADDF?style=for-the-badge)

---

## What Is AURORA?

AURORA is a production-grade, real-time space situational awareness dashboard that fuses live orbital mechanics, space weather, and satellite conjunction risk data into a single 3D intelligence interface.

It was built to answer the question the Palantir co-founder asked when WorldView went viral: *"Where's the real data fusion?"*

AURORA is that answer. It combines:

- A **Rust orbital propagation engine** computing live satellite positions and collision probabilities for 8,000+ objects in real time
- A **Go-based streaming ingestion layer** pulling from 5 public data sources simultaneously
- An **Apache Kafka backbone** with 7 purpose-built topics routing data from ingestion → processing → visualization
- A **Prometheus + Grafana observability stack** monitoring the entire pipeline with custom space domain metrics
- A **CesiumJS 3D globe frontend** with mission-control aesthetics, 4 visual modes, and a solar system heliocentric view

This is not a demo. This is a distributed systems project with a jaw-dropping frontend.

---

## Live Data Sources (All Free)

| Source | Data | Update Frequency |
|--------|------|-----------------|
| [CelesTrak](https://celestrak.org) | TLE orbital elements for all active satellites | Every 2 hours |
| [Space-Track.org](https://space-track.org) | Conjunction Data Messages (CDMs) — US Space Force collision warnings | Every 8 hours |
| [NOAA SWPC](https://swpc.noaa.gov) | Solar wind speed, density, Bz component, Kp index | Every 1 minute |
| [NOAA Ovation Prime](https://swpc.noaa.gov) | Aurora forecast oval parameters (both poles) | Every 5 minutes |
| [NASA DONKI](https://api.nasa.gov) | Coronal Mass Ejection (CME) events and arrival predictions | Real-time |

---

## Tech Stack

### Backend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Ingestion | **Go 1.26** | 4 concurrent data source connectors |
| Stream Bus | **Apache Kafka** | 7 topics routing all data flows |
| Orbital Engine | **Rust 1.93** | SGP4 propagation, conjunction analysis |
| API Gateway | **Go (gorilla/websocket)** | WebSocket server, frontend bridge |
| Observability | **Prometheus + Grafana** | Pipeline health + space environment dashboards |
| Infrastructure | **Docker Compose → AWS** | Local first, cloud-ready |

### Frontend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **React 18 + TypeScript + Vite** | Component architecture |
| 3D Globe | **CesiumJS** | Photorealistic Earth, orbital rendering |
| State | **Zustand** | Global app state management |
| Styling | **Tailwind CSS** | HUD panels and UI components |

### Cloud (Later)
| Service | Purpose |
|---------|---------|
| AWS MSK | Managed Kafka |
| AWS ECS Fargate | Go ingestion services |
| AWS EC2 | Rust orbital engine |
| AWS S3 | Event replay / archival |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
│  CelesTrak    Space-Track    NOAA SWPC    NOAA Ovation    NASA   │
└──────┬───────────┬──────────────┬────────────┬──────────────┬───┘
       │           │              │            │              │
       ▼           ▼              ▼            ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GO INGESTION SERVICES                          │
│   celestrak/    spacetrack/    noaa/    ovation/    nasa-donki/  │
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
│   aurora.satellites.positions    (propagated positions)          │
│   aurora.conjunctions.raw        (raw CDM data)                  │
│   aurora.conjunctions.alerts     (processed risk alerts)         │
│   aurora.spaceweather.raw        (raw NOAA/NASA data)            │
│   aurora.spaceweather.processed  (normalized state)              │
│   aurora.aurora.forecast         (oval parameters)               │
└───────────┬──────────────────────────────┬──────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────┐      ┌───────────────────────────────────┐
│   RUST ENGINE         │      │   GO GATEWAY                      │
│                       │      │                                   │
│ • SGP4 propagation    │      │ • Consumes all processed topics   │
│ • 8,000+ satellites   │      │ • WebSocket server                │
│ • Conjunction analysis│      │ • Broadcasts to frontend clients  │
│ • Collision Pc calc   │      │ • State snapshot on connect       │
│ • CDM processing      │      │                                   │
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

## Kafka Topics

| Topic | Producer | Consumer | Description |
|-------|----------|----------|-------------|
| `aurora.satellites.tle` | Go/CelesTrak | Rust Engine | Raw Two-Line Element sets |
| `aurora.satellites.positions` | Rust Engine | Go Gateway | Propagated lat/lon/alt every 30s |
| `aurora.conjunctions.raw` | Go/Space-Track | Rust Engine | Raw CDM conjunction data |
| `aurora.conjunctions.alerts` | Rust Engine | Go Gateway | Processed risk alerts with Pc |
| `aurora.spaceweather.raw` | Go/NOAA | Go/NOAA processor | Raw solar wind + Kp data |
| `aurora.spaceweather.processed` | Go/NOAA processor | Go Gateway | Normalized space weather state |
| `aurora.aurora.forecast` | Go/NOAA Ovation | Go Gateway | Aurora oval lat/intensity params |

---

## Prometheus Metrics

Every Go service exposes `/metrics` with these custom gauges and counters:

```
aurora_kafka_messages_produced_total     # counter, per topic
aurora_kafka_messages_consumed_total     # counter, per topic
aurora_api_fetch_duration_seconds        # histogram, per source
aurora_api_fetch_errors_total            # counter, per source
aurora_satellites_tracked                # gauge
aurora_conjunctions_active               # gauge  
aurora_kp_index_current                  # gauge
aurora_engine_propagation_latency_ms     # histogram
```

Two Grafana dashboards are auto-provisioned:
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
| Satellites | CelesTrak → Rust Engine | 8,000+ objects, color-coded by conjunction risk |
| Conjunction Threads | Space-Track CDMs | Glowing lines connecting high-risk pairs |
| Aurora Ovals | NOAA Ovation | Live polar aurora forecast, expands with Kp |
| Magnetosphere Shell | Derived from solar wind | Translucent ellipsoid, pulses with storm intensity |
| Solar Wind Particles | NOAA DSCOVR | Animated particle stream from sun direction |
| Space Weather HUD | NOAA SWPC | Live Kp, Bz, solar wind speed/density |
| CME Propagation | NASA DONKI | Expanding cone in Helio mode |

---

## Project Structure

```
aurora/
├── frontend/                    # React + TypeScript + CesiumJS
│   ├── src/
│   │   ├── components/
│   │   │   ├── GlobeView.tsx    # CesiumJS globe, all visual layers
│   │   │   ├── HUD.tsx          # Overlay panels, alerts ticker
│   │   │   ├── panels/          # Satellite, conjunction, weather panels
│   │   │   └── modes/           # OPS, STORM, INTEL, HELIO mode logic
│   │   ├── hooks/               # useWebSocket, useSpaceWeather, etc.
│   │   ├── store/
│   │   │   └── auroraStore.ts   # Zustand global state
│   │   ├── types/               # TypeScript interfaces
│   │   ├── utils/               # Colors, orbit math, coordinate utils
│   │   └── data/mock/           # Mock data for offline development
│   ├── .env.example             # Required environment variables
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── ingestion/
│   │   ├── celestrak/           # Go: TLE fetcher → Kafka producer
│   │   ├── spacetrack/          # Go: CDM fetcher → Kafka producer
│   │   ├── noaa/                # Go: Space weather → Kafka producer
│   │   └── nasa-donki/          # Go: CME events → Kafka producer
│   ├── engine/                  # Rust: SGP4 propagation + conjunction
│   ├── gateway/                 # Go: WebSocket server
│   └── shared/                  # Go: shared types, Kafka wrapper
│
└── infra/
    ├── docker-compose.yml       # Kafka + Zookeeper + Prometheus + Grafana
    ├── prometheus/
    │   └── prometheus.yml
    └── grafana/
        └── dashboards/
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) |
| Go | 1.26+ | [golang.org/dl](https://golang.org/dl) |
| Rust | 1.93+ | [rustup.rs](https://rustup.rs) |
| Docker Desktop | 28+ | [docker.com](https://docker.com/products/docker-desktop) |
| Git | 2.49+ | [git-scm.com](https://git-scm.com) |

---

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env` and fill in your keys:

```env
VITE_CESIUM_ION_TOKEN=        # ion.cesium.com (free account)
VITE_NASA_API_KEY=             # api.nasa.gov (free, instant)
VITE_SPACETRACK_USERNAME=      # space-track.org (free account)
VITE_SPACETRACK_PASSWORD=      # space-track.org password
VITE_WS_URL=ws://localhost:8080/ws
```

All keys are free. No paid APIs.

---

## Getting Started

### 1. Clone and install frontend

```powershell
git clone https://github.com/sripadsirik/aurora.git
cd aurora/frontend
npm install
copy .env.example .env
# Fill in your API keys in .env
npm run dev
```

Frontend runs at `http://localhost:5173`

### 2. Start the infrastructure (Kafka + Prometheus + Grafana)

```powershell
cd aurora/infra
docker compose up -d
```

| Service | URL |
|---------|-----|
| Kafka | localhost:9092 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 (admin/admin) |

### 3. Start the Go ingestion services

```powershell
cd aurora/backend/ingestion/celestrak
go run .

# In separate terminals:
cd aurora/backend/ingestion/noaa
go run .

cd aurora/backend/ingestion/spacetrack
go run .

cd aurora/backend/ingestion/nasa-donki
go run .
```

### 4. Start the Rust orbital engine

```powershell
cd aurora/backend/engine
cargo run --release
```

### 5. Start the Go gateway

```powershell
cd aurora/backend/gateway
go run .
```

Frontend automatically switches from mock data to live data when the WebSocket connects.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | OPS Mode (default) |
| `2` | STORM Mode |
| `3` | INTEL Mode (CRT aesthetic) |
| `4` | HELIO Mode (solar system view) |
| `T` | Toggle timeline scrubber |
| `Left drag` | Pan camera |
| `Right drag` | Orbit/rotate globe |
| `Scroll` | Zoom in/out |
| `Ctrl + Left drag` | Tilt camera |
| `Click satellite` | Open satellite detail panel |
| `Click alert` | Open conjunction detail panel |

---

## Why This Is Different From WorldView

WorldView (the viral "vibe-coded Palantir") is a frontend triumph with a backend vacuum. It polls public APIs directly from the browser, crashes when too many particles spawn, and has no data pipeline, no fault tolerance, no entity resolution, and no observability.

AURORA is what WorldView would look like if it had a real engineering team behind it:

| Feature | WorldView | AURORA |
|---------|-----------|--------|
| Data ingestion | Browser polling | Go services with retry/backoff |
| Stream processing | None | Apache Kafka, 7 topics |
| Orbital mechanics | None (static positions) | Rust SGP4 engine |
| Collision risk | Visual only | Real Pc calculation from CDMs |
| Observability | None | Prometheus + Grafana dashboards |
| Fault tolerance | "network error retry 9s" in UI | Per-service error handling |
| Solar system view | None | Full heliocentric CME visualization |
| Timeline/playback | None | Historical event replay system |
| Production ready | No | Docker Compose → AWS path |

---

## Roadmap

- [ ] Phase 1: Frontend globe foundation (CesiumJS, all visual layers, HUD)
- [ ] Phase 2: Interactive panels (satellite detail, conjunction, space weather)
- [ ] Phase 3: Visual modes + timeline scrubber
- [ ] Phase 4: Backend ingestion services (Go)
- [ ] Phase 5: Rust orbital engine (SGP4 + conjunction analysis)
- [ ] Phase 6: Go WebSocket gateway
- [ ] Phase 7: Frontend ↔ backend integration (replace mock data)
- [ ] Phase 8: AWS deployment (MSK, ECS, EC2)
- [ ] Phase 9: Entity resolution (link satellites to operators, missions)
- [ ] Phase 10: Predictive storm impact modeling

---

## Credits & Data Attribution

- Orbital data: [CelesTrak](https://celestrak.org) — Dr. T.S. Kelso
- Conjunction data: [18th Space Defense Squadron](https://space-track.org) via Space-Track.org
- Space weather: [NOAA Space Weather Prediction Center](https://swpc.noaa.gov)
- CME data: [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/)
- Globe rendering: [CesiumJS](https://cesium.com) + Cesium ion

---

## License

MIT — build on it, fork it, show it off.

---

*Built by Sripapa — CS @ UIC + Georgia Tech M.S. CS*
*"If you've got domain expertise, this is the time to put it to work."*
