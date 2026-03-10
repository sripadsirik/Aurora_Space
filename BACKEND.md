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
| spacetrack | Go | 2116 (metrics, recommended) | CDM conjunction data every 6h |
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
# 1. Build backend binaries once
cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
go build -o .\bin\gateway.exe .\gateway
go build -o .\bin\engine.exe .\engine
go build -o .\bin\noaa.exe .\ingestion\noaa
go build -o .\bin\celestrak.exe .\ingestion\celestrak
go build -o .\bin\spacetrack.exe .\ingestion\spacetrack

# 2. Start Docker infra
cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora
docker compose -f .\infra\docker-compose.yml up -d

# 3. Start services in separate PowerShell windows
cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
.\bin\gateway.exe

cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
.\bin\engine.exe

cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
.\bin\noaa.exe

cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
.\bin\celestrak.exe

# 4. Optional: conjunction feed
cd C:\Users\sripa\OneDrive\Documents\GitHub\Aurora\backend
$env:SPACETRACK_USERNAME="you@email.com"
$env:SPACETRACK_PASSWORD="xxx"
$env:METRICS_PORT_INGESTION="2116"
.\bin\spacetrack.exe
```

## Environment Variables

See `backend/.env.example` for all configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker addresses |
| `WS_PORT` | `8080` | WebSocket server port |
| `METRICS_PORT_GATEWAY` | `2112` | Gateway Prometheus metrics |
| `METRICS_PORT_INGESTION` | `2113` | Ingestion services metrics |
| `METRICS_PORT_CELESTRAK` | `2115` | CelesTrak metrics |
| `METRICS_PORT_ENGINE` | `2114` | SGP4 engine metrics |
| `SPACETRACK_USERNAME` | — | Space-Track.org login |
| `SPACETRACK_PASSWORD` | — | Space-Track.org password |

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Gateway health**: http://localhost:8080/health

## Data Sources

- [CelesTrak GP API](https://celestrak.org/NORAD/elements/) — Satellite TLE catalog
- [NOAA SWPC](https://services.swpc.noaa.gov/) — Kp index, solar wind, Bz, X-ray flux
- [Space-Track CDM](https://www.space-track.org/) — Conjunction Data Messages
