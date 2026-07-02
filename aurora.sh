#!/usr/bin/env bash
# ── Aurora SSA — one-command launcher (macOS / Linux) ────────────────────────
# Usage:
#   ./aurora.sh            start everything (infra + backend + frontend)
#   ./aurora.sh stop       stop everything and tear down docker infra
#   ./aurora.sh status     show running services and URLs
#
# Reads configuration (incl. SPACETRACK_* creds) from backend/.env.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
INFRA_DIR="$REPO_ROOT/infra"
ENV_FILE="$BACKEND_DIR/.env"
STATE_DIR="$REPO_ROOT/.aurora"
LOGS_DIR="$STATE_DIR/logs"
PID_FILE="$STATE_DIR/pids"

log()  { printf '\033[36m[aurora]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[aurora]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[aurora]\033[0m %s\n' "$*" >&2; }

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    err "Missing $ENV_FILE (copy backend/.env.example to backend/.env)"; exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  : "${KAFKA_BROKERS:=localhost:9092}"
  : "${METRICS_PORT_ENGINE_RUST:=2117}"
  export KAFKA_BROKERS METRICS_PORT_ENGINE_RUST
}

wait_for_kafka() {
  local hostport="${KAFKA_BROKERS%%,*}"
  local host="${hostport%%:*}" port="${hostport##*:}"
  log "Waiting for Kafka at $host:$port ..."
  for _ in $(seq 1 60); do
    if nc -z "$host" "$port" >/dev/null 2>&1; then log "Kafka is up."; return 0; fi
    sleep 1
  done
  err "Kafka did not become reachable at $host:$port"; exit 1
}

start_service() {
  local name="$1"; shift
  log "Starting $name ..."
  ( cd "$BACKEND_DIR" && "$@" ) >"$LOGS_DIR/$name.log" 2>&1 &
  echo "$name $!" >>"$PID_FILE"
}

start() {
  load_env
  mkdir -p "$LOGS_DIR"
  : >"$PID_FILE"

  log "Bringing up docker infra (Kafka, Prometheus, Grafana) ..."
  docker compose -f "$INFRA_DIR/docker-compose.yml" up -d
  wait_for_kafka

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Installing frontend dependencies ..."
    ( cd "$FRONTEND_DIR" && npm install )
  fi

  start_service gateway   go run ./gateway/...
  start_service celestrak go run ./ingestion/celestrak/...
  start_service noaa      go run ./ingestion/noaa/...
  start_service engine-rust cargo run --release --manifest-path engine-rust/Cargo.toml

  if [[ -n "${SPACETRACK_USERNAME:-}" && -n "${SPACETRACK_PASSWORD:-}" ]]; then
    start_service spacetrack go run ./ingestion/spacetrack/...
  else
    warn "Skipping spacetrack (SPACETRACK_USERNAME/PASSWORD not set in backend/.env)"
  fi

  log "Starting frontend ..."
  ( cd "$FRONTEND_DIR" && npm run dev ) >"$LOGS_DIR/frontend.log" 2>&1 &
  echo "frontend $!" >>"$PID_FILE"

  status
  log "All services running. Logs in .aurora/logs/. Press Ctrl+C to stop everything."
  trap stop INT TERM
  wait
}

# Recursively kill a process and all its descendants. `go run` and `cargo run`
# spawn a compiled child that holds the port, so killing only the parent leaks it.
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" >/dev/null 2>&1 || true
}

stop() {
  trap - INT TERM
  if [[ -f "$PID_FILE" ]]; then
    while read -r name pid; do
      [[ -n "${pid:-}" ]] || continue
      if kill -0 "$pid" >/dev/null 2>&1; then
        log "Stopping $name (pid $pid)"
        kill_tree "$pid"
      fi
    done <"$PID_FILE"
    rm -f "$PID_FILE"
  fi
  log "Tearing down docker infra ..."
  docker compose -f "$INFRA_DIR/docker-compose.yml" down || true
  log "Aurora stopped."
  exit 0
}

status() {
  echo ""
  log "Aurora URLs:"
  echo "  Frontend    : http://localhost:5173"
  echo "  WebSocket   : ws://localhost:8080/ws"
  echo "  Gateway API : http://localhost:8080/health"
  echo "  Prometheus  : http://localhost:9090"
  echo "  Grafana     : http://localhost:3001  (admin/admin)"
  echo ""
}

case "${1:-start}" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  *) err "Usage: ./aurora.sh [start|stop|status]"; exit 1 ;;
esac
