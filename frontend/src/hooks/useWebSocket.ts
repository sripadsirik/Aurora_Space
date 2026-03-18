import { useEffect, useRef } from "react";

import { useAuroraStore } from "../store/auroraStore";
import type { Conjunction, Satellite, SourceDiagnostic, SpaceWeather } from "../types/space";
import { env } from "../utils/env";

// ── Typed inbound messages ──────────────────────────────────────────────────

interface SatelliteUpdateMessage {
  type: "satellites";
  payload: Satellite[];
}

interface ConjunctionUpdateMessage {
  type: "conjunctions";
  payload: Conjunction[];
}

interface SpaceWeatherUpdateMessage {
  type: "spaceWeather";
  payload: SpaceWeather;
}

interface ConnectedMessage {
  type: "connected";
  payload: { serverTime: string };
}

export type WebSocketMessage =
  | SatelliteUpdateMessage
  | ConjunctionUpdateMessage
  | SpaceWeatherUpdateMessage
  | ConnectedMessage;

interface DiagnosticsResponse {
  generatedAt: string;
  rows: SourceDiagnostic[];
}

// ── Hook ────────────────────────────────────────────────────────────────────

const RECONNECT_INTERVAL_MS = 5_000;
const DIAGNOSTICS_POLL_INTERVAL_MS = 5_000;

const getDiagnosticsUrl = (wsUrl: string): string | null => {
  try {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/diagnostics";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

export const useWebSocket = (): void => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wsUrl = env.VITE_WS_URL;
    if (!wsUrl) return;
    const diagnosticsUrl = getDiagnosticsUrl(wsUrl);
    let diagnosticsTimer: ReturnType<typeof setInterval> | null = null;
    let diagnosticsAbort: AbortController | null = null;

    const fetchDiagnostics = async (): Promise<void> => {
      if (!diagnosticsUrl) return;

      diagnosticsAbort?.abort();
      diagnosticsAbort = new AbortController();

      try {
        const response = await fetch(diagnosticsUrl, {
          signal: diagnosticsAbort.signal
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as DiagnosticsResponse;
        useAuroraStore.getState().setSourceDiagnostics(payload.rows);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    const connect = (): void => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        useAuroraStore.setState({ isConnectedToBackend: true });
        void fetchDiagnostics();
      });

      ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;

          switch (message.type) {
            case "satellites":
              useAuroraStore.setState({ satellites: message.payload });
              useAuroraStore.getState().recordFeedUpdate("satellites");
              break;
            case "conjunctions":
              useAuroraStore.setState({
                conjunctions: message.payload.map((c) => ({
                  ...c,
                  tca: new Date(c.tca)
                }))
              });
              useAuroraStore.getState().recordFeedUpdate("conjunctions");
              break;
            case "spaceWeather":
              useAuroraStore.setState({
                spaceWeather: {
                  ...message.payload,
                  lastUpdated: new Date(message.payload.lastUpdated)
                }
              });
              useAuroraStore.getState().recordFeedUpdate("spaceWeather");
              break;
            case "connected":
              // Server acknowledged connection — no action needed
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.addEventListener("close", () => {
        useAuroraStore.setState({ isConnectedToBackend: false });
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });
    };

    connect();
    void fetchDiagnostics();
    diagnosticsTimer = setInterval(() => {
      void fetchDiagnostics();
    }, DIAGNOSTICS_POLL_INTERVAL_MS);

    return () => {
      diagnosticsAbort?.abort();
      if (diagnosticsTimer) clearInterval(diagnosticsTimer);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
};
