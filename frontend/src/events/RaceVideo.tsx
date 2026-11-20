import { useCallback, useEffect, useState } from "react";
import { HlsVideo } from "../earth/CameraMedia";
type Source = { kind: "file" | "video" | "hls" | "youtube"; url: string };
function streamSource(value: string): Source {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password) throw Error();
  const yt = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
  ].includes(u.hostname);
  if (yt) {
    const id = u.searchParams.get("v") || u.pathname.split("/").pop();
    if (!id || !/^[-\w]{11}$/.test(id)) throw Error();
    return {
      kind: "youtube",
      url: "https://www.youtube-nocookie.com/embed/" + id,
    };
  }
  if (/\.m3u8$/i.test(u.pathname)) return { kind: "hls", url: u.href };
  if (/\.(mp4|webm|m4v)$/i.test(u.pathname))
    return { kind: "video", url: u.href };
  throw Error();
}
export function RaceVideo({
  vegas,
  onClose,
}: {
  vegas: boolean;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (source?.kind === "file") URL.revokeObjectURL(source.url);
    },
    [source],
  );
  const fail = useCallback(
    () =>
      setError(
        "Playback unavailable. Check that the source allows playback in this browser.",
      ),
    [],
  );
  return (
    <aside className="race-video-panel" aria-label="Race video">
      <header>
        <strong>Race video</strong>
        <button onClick={onClose} aria-label="Close video">
          ×
        </button>
      </header>
      {vegas && !source && (
        <a
          className="race-clip"
          href="https://www.youtube.com/watch?v=sKe57Zn66FU"
          target="_blank"
          rel="noreferrer"
        >
          <img alt="" src="https://i.ytimg.com/vi/sKe57Zn66FU/mqdefault.jpg" />
          <span>Practice 2 highlights · YouTube ↗</span>
        </a>
      )}
      {vegas && (
        <div className="race-broadcast">
          <a
            href="https://tv.apple.com/us/collection/las-vegas-grand-prix/edt.col.6a989696-c5d8-4e04-9365-0d59ab348b05"
            target="_blank"
            rel="noreferrer"
          >
            Watch Vegas free on Apple TV (US) ↗
          </a>
          <p>
            Use Picture in Picture in the broadcaster’s player to float it above
            Earth where supported.
          </p>
        </div>
      )}
      {source &&
        (source.kind === "youtube" ? (
          <iframe
            title="Race video player"
            src={source.url}
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : source.kind === "hls" ? (
          <HlsVideo url={source.url} name="Race" onError={fail} />
        ) : (
          <video
            aria-label="Race video player"
            key={source.url}
            src={source.url}
            controls
            playsInline
            onError={fail}
          />
        ))}
      {source?.kind === "youtube" && (
        <a
          href={
            "https://www.youtube.com/watch?v=" + source.url.split("/").pop()
          }
          target="_blank"
          rel="noreferrer"
        >
          Open on YouTube ↗
        </a>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setSource(streamSource(url.trim()));
            setError("");
          } catch {
            setError("Enter an HTTPS YouTube, HLS (.m3u8), MP4 or WebM link.");
          }
        }}
      >
        <label>
          Video or stream URL
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <button>Load video</button>
      </form>
      <label>
        Open a replay file{" "}
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setSource({ kind: "file", url: URL.createObjectURL(f) });
              setError("");
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
