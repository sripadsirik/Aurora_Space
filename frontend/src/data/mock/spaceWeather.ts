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

/**
 * A 24-hour planetary Kp history used to drive the storm panel's sparkline, one
 * reading every three hours (oldest first). The series rises into a storm and
 * eases back off, ending at {@link mockSpaceWeather.kpIndex} so the sparkline's
 * final point lines up with the snapshot's current reading.
 */
export const mockKp24hHistory = [
  2.3, 2.1, 2.5, 2.8, 3.0, 3.2, 3.1, 2.9,
  3.4, 3.8, 4.1, 4.5, 4.8, 5.2, 5.6, 5.9,
  6.2, 6.8, 7.1, 6.5, 5.8, 5.2, 4.8, 4.3
];
