# Aurora Backend Architecture

## System Overview

```
CelesTrak API ──► celestrak ingestion ──► Kafka [aurora.satellites.tle]
                                               │
                                               ▼
                                          SGP4 engine ──► Kafka [aurora.satellites.positions]
                                                               │
NOAA SWPC API ──► noaa ingestion ──► Kafka [aurora.spaceweather.processed] ──┤
                                                                              ▼
Space-Track API ──► spacetrack ingestion ──► Kafka [aurora.conjunctions.alerts] ──► Gateway ──► WebSocket ──► Frontend
```

## Services

| Service | Language | Port | Description |
|---------|----------|------|-------------|
| gateway | Go | 8080 (WS), 2112 (metrics) | WebSocket server broadcasting to frontend |
| celestrak | Go | 2115 (metrics) | TLE ingestion from CelesTrak every 2h |
| noaa | Go | 2113 (metrics) | Space weather from NOAA SWPC every 1-3min |
| spacetrack | Go | 2116 (metrics) | CDM conjunction data every 6h |
| engine | Go | 2114 (metrics) | SGP4 orbital propagation every 30s |

## Kafka Topics

| Topic | Producer | Consumer | Schema |
|-------|----------|----------|--------|
| `aurora.satellites.tle` | celestrak | engine | parsed 3LE records |
| `aurora.satellites.positions` | engine | gateway | `SatelliteBatch` chunks reassembled by gateway |
| `aurora.conjunctions.alerts` | spacetrack | gateway | `ConjunctionWarning[]` |
| `aurora.spaceweather.processed` | noaa | gateway | `SpaceWeather` |

## Quick Start

```powershell
# 1. Start Docker infra (Kafka, Zookeeper, Prometheus, Grafana)
cd aurora_space\infra
docker compose up -d

# 2. Build all backend binaries
cd aurora_space\backend
go build -o .\bin\gateway.exe .\gateway
go build -o .\bin\engine.exe .\engine
go build -o .\bin\noaa.exe .\ingestion\noaa
go build -o .\bin\celestrak.exe .\ingestion\celestrak
go build -o .\bin\spacetrack.exe .\ingestion\spacetrack

# 3. Start services (each in a separate terminal, in this order)

# Terminal 1 — Gateway (must start first)
cd aurora_space\backend
.\bin\gateway.exe

# Terminal 2 — Engine
cd aurora_space\backend
.\bin\engine.exe

# Terminal 3 — CelesTrak ingestion
cd aurora_space\backend
.\bin\celestrak.exe

# Terminal 4 — NOAA ingestion
cd aurora_space\backend
.\bin\noaa.exe

# Terminal 5 — Space-Track ingestion (optional, requires account)
cd aurora_space\backend
$env:SPACETRACK_USERNAME="you@email.com"
$env:SPACETRACK_PASSWORD="xxx"
.\bin\spacetrack.exe
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses |
| `WS_PORT` | `8080` | WebSocket server port |
| `METRICS_PORT_GATEWAY` | `2112` | Gateway Prometheus metrics |
| `METRICS_PORT_NOAA` | `2113` | NOAA ingestion metrics |
| `METRICS_PORT_ENGINE` | `2114` | SGP4 engine metrics |
| `METRICS_PORT_CELESTRAK` | `2115` | CelesTrak ingestion metrics |
| `METRICS_PORT_SPACETRACK` | `2116` | Space-Track ingestion metrics |
| `SPACETRACK_USERNAME` | — | Space-Track.org login |
| `SPACETRACK_PASSWORD` | — | Space-Track.org password |

## Testing

Unit tests cover the pure helper logic in the `shared` package (orbit/risk/storm
classification, `.env` parsing) and the `gateway` diagnostics helpers (status
derivation, log summarisation, source-row builders). Run them from `backend/`:

```bash
make test   # go test ./...
make vet    # go vet ./...
```

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Gateway health**: http://localhost:8080/health

## Data Sources

- [CelesTrak GP API](https://celestrak.org/NORAD/elements/) — Satellite TLE catalog
- [NOAA SWPC](https://services.swpc.noaa.gov/) — Kp index, solar wind, Bz, X-ray flux
- [Space-Track CDM](https://www.space-track.org/) — Conjunction Data Messages (requires free account)
