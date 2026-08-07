import type { SpaceWeather } from "../../types/space";

export const mockSpaceWeather: SpaceWeather = {
  kpIndex: 4.3,
  solarWindSpeed: 450,
  solarWindDensity: 8.2,
  bzComponent: -12.4,
  xrayFlux: "C2.4",
  protonFlux: 42,
  stormLevel: "moderate",
  auroraKp: 4,
  lastUpdated: new Date()
};
