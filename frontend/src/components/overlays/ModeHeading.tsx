import { useAuroraStore } from "../../store/auroraStore";
import { DataStatusIndicator } from "../DataStatusIndicator";

const titles = {
  STORM: ["02 / SPACE WEATHER", "Storm watch", "Magnetosphere · Atmospheric exposure"],
  INTEL: ["03 / ORBITAL INTELLIGENCE", "Conjunction assessment", "Report review · Data quality · Operator coordination"],
  HELIO: ["04 / SOLAR OBSERVATORY", "From Sun to Earth", "Solar wind · Coronal mass ejections"]
} as const;

export function ModeHeading() {
  const mode = useAuroraStore(s => s.currentMode);
  if (mode === "OPS") return null;
  const [eyebrow, title, subtitle] = titles[mode];
  return <header className="mode-heading">
    <div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div>
    <div className="mode-heading-status"><span>A U R O R A</span><DataStatusIndicator /></div>
  </header>;
}
