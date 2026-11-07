import { useEffect, useState } from "react";
import { env } from "../utils/env";
import { useEarth } from "./store";
import { cameraNetworks, filterCameras } from "./cameraNetworks";
import { mergeCameraFeeds, parsePublicCameras } from "./publicCameras";
import type { TrafficCamera } from "./data";
import { chicagoCameras } from "./chicagoCameras";

export function useCameraFeeds(enabled: boolean) {
  const [info, setInfo] = useState({ fetched: "", errors: [] as string[], loading: true });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const cached = new Map<string, { cameras: TrafficCamera[]; at: string }>();
    const poll = async () => {
      const errors: string[] = [];
      await Promise.all(cameraNetworks.flatMap(network => network.feeds.map(async feed => {
        try {
          if (!env.VITE_WS_URL) throw Error("Start the live gateway");
          const url = new URL(env.VITE_WS_URL);
          url.protocol = url.protocol === "wss:" ? "https:" : "http:";
          url.pathname = "/api/earth/cameras/" + feed;
          url.search = "";
          url.hash = "";
          const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
          const body = await response.json();
          if (!response.ok) throw Error(body.error || `HTTP ${response.status}`);
          if (!Number.isFinite(Date.parse(body.fetchedAt))) throw Error("Invalid feed timestamp");
          const cameras = parsePublicCameras(body.data, feed);
          cached.set(feed, { cameras, at: body.fetchedAt });
          if (body.stale) errors.push(`${network.name} (${feed}): cached feed`);
          if (feed === "illinois-3" && body.data?.exceededTransferLimit === true)
            errors.push("Illinois & Midwest: the provider catalog exceeds the connected 4,000-entry pages; coverage is incomplete.");
        } catch (error) {
          errors.push(`${network.name} (${feed}): ${error instanceof Error ? error.message : "unavailable"}`);
        }
      })));
      if (controller.signal.aborted) return;
      const values = cameraNetworks.flatMap(n => n.feeds).flatMap(feed => cached.has(feed) ? [cached.get(feed)!] : []);
      const cameras = mergeCameraFeeds([...chicagoCameras, ...values.flatMap(v => v.cameras)]);
      const fetched = values.length ? new Date(Math.min(...values.map(v => Date.parse(v.at)))).toISOString() : "";
      const state = useEarth.getState();
      state.set({ cameras, feed: { at: fetched, error: errors.length > 0 },
        ...(!state.selected && cameras.length ? { selected: filterCameras(cameras, state.cameraNetwork, state.cameraArea)[0]?.id ?? null } : {}),
      });
      setInfo({ fetched, errors, loading: false });
      timer = setTimeout(poll, 60000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled]);
  return info;
}
