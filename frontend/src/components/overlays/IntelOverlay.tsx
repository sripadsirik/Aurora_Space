import { useAuroraStore } from "../../store/auroraStore";

export const IntelOverlay = (): JSX.Element | null => {
  const currentMode = useAuroraStore((s) => s.currentMode);

  if (currentMode !== "INTEL") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background: "repeating-linear-gradient(0deg, rgba(0,255,68,0.04) 0px, rgba(0,255,68,0.04) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none"
        }}
      />

      {/* Subtle green phosphor tint */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,255,68,0.02) 0%, rgba(0,255,68,0.04) 50%, rgba(0,40,10,0.08) 100%)",
          mixBlendMode: "screen"
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)"
        }}
      />
    </div>
  );
};
