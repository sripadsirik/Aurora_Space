import { useEffect, useRef, useState } from "react";
import type { TrafficCamera } from "./data";
import { useUtcClock } from "../hooks/useUtcClock";

function HlsVideo({ url, name, onError }: { url: string; name: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    let disposed = false;
    let destroy: (() => void) | undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) { onError(); return; }
        const hls = new Hls();
        destroy = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) { hls.destroy(); onError(); }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      }).catch(() => { if (!disposed) onError(); });
    }
    return () => {
      disposed = true;
      destroy?.();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url, onError]);
  return <video ref={ref} aria-label={`${name} live video`} controls autoPlay muted playsInline onError={onError} />;
}

export function CameraMedia({ camera }: { camera: TrafficCamera }) {
  const now = useUtcClock();
  const [snapshot, setSnapshot] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const refresh = Math.floor(now.getTime() / 60000);
  useEffect(() => setImageError(false), [refresh, retry]);
  // State setters are stable so ordinary clock ticks never restart a stream.
  const failVideo = useRef(() => setVideoError(true)).current;
  const image = camera.image ? new URL(camera.image) : null;
  if (image && camera.network !== "singapore") image.searchParams.set("aurora_refresh", `${refresh}-${retry}`);
  const showVideo = camera.video && !snapshot && !videoError;
  return <>
    <p className="earth-note">{showVideo ? "Live video · provider stream" : image ? "Snapshot · still image" : "Video unavailable"}</p>
    {camera.video && camera.image && <div className="inspector-actions">
      <button aria-pressed={!snapshot} onClick={() => { setSnapshot(false); setVideoError(false); }}>Live video</button>
      <button aria-pressed={snapshot} onClick={() => setSnapshot(true)}>Snapshot</button>
    </div>}
    {showVideo ? camera.video!.kind === "embed" ? (
      <iframe key={retry} className="earth-camera-video" title={`${camera.name} player`} src={camera.video!.url}
        allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
    ) : <HlsVideo key={retry} url={camera.video!.url} name={camera.name} onError={failVideo} /> : image ? (
      imageError ? <p>Image unavailable from the provider.</p> : <img src={image.href}
        alt={`${camera.name} public road image`} referrerPolicy="no-referrer" onError={() => setImageError(true)} />
    ) : <p>Video unavailable. Try the provider’s page.</p>}
    {videoError && <p role="status" className="earth-note">Video could not be loaded. {camera.image ? "Showing the provider snapshot instead." : "Open the provider page or retry."}</p>}
    {!camera.video && <p className="earth-note">This provider publishes snapshots for this camera; no public video stream is supplied.</p>}
    {camera.video?.kind === "embed" && <p className="earth-note">Use the player’s play button if needed. If playback stops, reload the player or open the provider page.</p>}
    <div className="inspector-actions">
      <button onClick={() => { setRetry(r => r + 1); setVideoError(false); setImageError(false); }}>{showVideo ? "Reload player" : "Retry media"}</button>
      {camera.providerUrl && <a href={camera.providerUrl} target="_blank" rel="noreferrer">Open provider page ↗</a>}
    </div>
  </>;
}
