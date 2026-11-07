export const pcLabel = (p: number | null | undefined) =>
  p == null ? "Unavailable" : p === 0 ? "< 1e−300" : p.toExponential(2);
export const distance = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
export const utc = (epoch: string, seconds = 0) =>
  new Date(Date.parse(epoch) + seconds * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
export const leadLabel = (seconds: number) =>
  `T−${+(seconds / 60).toFixed(1)} min`;
