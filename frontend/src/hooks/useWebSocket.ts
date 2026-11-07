import { satelliteSnapshotTime } from "../utils/snapshotTime";
import { satelliteChunkAssembler } from "../utils/satelliteChunks";
import { useEffect, useRef } from "react";
import { useFeedCapture } from "../mission/feedCapture";

import { useAuroraStore } from "../store/auroraStore";
import type { SourceDiagnostic } from "../types/space";
import { env } from "../utils/env";
import { currentConjunctions } from "../utils/conjunctionFeed";
import { parseFeedMessage } from "../utils/parseFeedMessage";

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
  const paused = useFeedCapture(s => s.paused);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wsUrl = env.VITE_WS_URL;
    if (!wsUrl || paused) { useAuroraStore.setState({ isConnectedToBackend: false }); return; }
    const diagnosticsUrl = getDiagnosticsUrl(wsUrl);
    let diagnosticsTimer: ReturnType<typeof setInterval> | null = null;
    let diagnosticsAbort: AbortController | null = null;
    let disposed = false;

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
        if (Array.isArray(payload?.rows)) {
          useAuroraStore.getState().setSourceDiagnostics(payload.rows);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    const connect = (): void => {
      if (disposed) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
        return;
      }
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (disposed) return;
        useAuroraStore.setState({ isConnectedToBackend: true });
        void fetchDiagnostics();
      });

      const assemble = satelliteChunkAssembler();
      const acceptMessage = (raw: unknown) => {
        try {
          if (disposed) return;

          const message = parseFeedMessage(raw);
          if (!message) return;
          useFeedCapture.getState().append(raw);

          switch (message.type) {
            case "satellites":
              useAuroraStore.setState(state => ({
                satellites: message.payload,
                selectedSatellite: state.selectedSatellite
                  ? message.payload.find(satellite => satellite.noradId === state.selectedSatellite!.noradId) ?? state.selectedSatellite
                  : null
              }));
              useAuroraStore.getState().recordFeedUpdate("satellites", satelliteSnapshotTime(message.payload));
              break;
            case "conjunctions":
              useAuroraStore.setState({
                conjunctions: currentConjunctions(message.payload),
                selectedConjunction: null,
                feedLastUpdated: { ...useAuroraStore.getState().feedLastUpdated, conjunctions: message.fetchedAt ?? null }
              });

              break;
            case "spaceWeather":
              useAuroraStore.setState({
                spaceWeather: message.payload
              });
              useAuroraStore.getState().recordFeedUpdate("spaceWeather", message.payload.lastUpdated);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };
      ws.addEventListener("message", event => {try {acceptMessage(assemble(JSON.parse(event.data as string)));} catch { /* Invalid JSON cannot replace current data. */ }});
      // HTTP bootstrap and recovery keep a large catalog available when a
      // browser/proxy cannot drain the WebSocket snapshot promptly.
      const recover = async () => {
        if(disposed) return;
        const updated=useAuroraStore.getState().feedLastUpdated.satellites;
        if(updated && Date.now()-new Date(updated).getTime()<45000) return;
        try {
          const url=new URL(wsUrl);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/snapshot';
          const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
          if(response.ok){const messages=await response.json();if(Array.isArray(messages)&&!disposed)messages.forEach(acceptMessage);}
        } catch { /* Retain last observed state and existing freshness indicators. */ }
      };
      void recover();
      const recoveryTimer=setInterval(()=>void recover(),30000);
      ws.addEventListener('close',()=>clearInterval(recoveryTimer),{once:true});

      ws.addEventListener("close", () => {
        if (disposed) return;
        useAuroraStore.setState({ isConnectedToBackend: false });
        wsRef.current = null;
        if (!disposed) reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });
    };

    const expiryTimer = setInterval(() => {
      const state = useAuroraStore.getState();
      const remaining = currentConjunctions(state.conjunctions);
      if (remaining.length !== state.conjunctions.length) useAuroraStore.setState({
        conjunctions: remaining,
        selectedConjunction: remaining.find((event) => event.id === state.selectedConjunction?.id) ?? null
      });
    }, 30000);
    connect();
    void fetchDiagnostics();
    diagnosticsTimer = setInterval(() => {
      void fetchDiagnostics();
    }, DIAGNOSTICS_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(expiryTimer);
      diagnosticsAbort?.abort();
      if (diagnosticsTimer) clearInterval(diagnosticsTimer);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [paused]);
};
