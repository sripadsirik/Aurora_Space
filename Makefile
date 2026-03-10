# ── Aurora SSA — Build & Run ─────────────────────────────────────────────────

.PHONY: all build build-go infra infra-down run-gateway run-celestrak run-noaa run-spacetrack run-engine stop clean

# ── Build ────────────────────────────────────────────────────────────────────

all: build

build: build-go

build-go:
	cd backend && go build -o bin/gateway     ./gateway/...
	cd backend && go build -o bin/celestrak    ./ingestion/celestrak/...
	cd backend && go build -o bin/noaa         ./ingestion/noaa/...
	cd backend && go build -o bin/spacetrack   ./ingestion/spacetrack/...
	cd backend && go build -o bin/engine       ./engine/...
	@echo "All Go services built → backend/bin/"

# ── Infrastructure ───────────────────────────────────────────────────────────

infra: run-infra

run-infra:
	docker compose -f infra/docker-compose.yml up -d

infra-down:
	docker compose -f infra/docker-compose.yml down

# ── Run individual services ──────────────────────────────────────────────────

run-gateway:
	cd backend && go run ./gateway/...

run-celestrak:
	cd backend && go run ./ingestion/celestrak/...

run-noaa:
	cd backend && go run ./ingestion/noaa/...

run-spacetrack:
	cd backend && go run ./ingestion/spacetrack/...

run-engine:
	cd backend && go run ./engine/...

run-frontend:
	cd frontend && npm run dev

# ── Stop ─────────────────────────────────────────────────────────────────────

stop:
	docker compose -f infra/docker-compose.yml down

# ── Clean ────────────────────────────────────────────────────────────────────

clean:
	rm -rf backend/bin
	rm -f backend/*.exe
