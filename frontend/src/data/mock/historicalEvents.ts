import type { HistoricalEvent } from "../../types/space";

export const historicalEvents: HistoricalEvent[] = [
  {
    id: "halloween-storm-2003",
    name: "Halloween Storm - Kp 9, X17 Flare",
    date: new Date("2003-10-28T00:00:00Z"),
    description:
      "One of the most powerful solar storms ever recorded. X17 flare caused widespread satellite anomalies, HF radio blackouts, and aurora visible as far south as Florida.",
    type: "solar_storm",
    kpIndex: 9,
    solarWindSpeed: 1850,
    bzComponent: -45,
    stormLevel: "extreme"
  },
  {
    id: "iridium-cosmos-2009",
    name: "Iridium-Cosmos Collision",
    date: new Date("2009-02-10T00:00:00Z"),
    description:
      "First accidental hypervelocity collision between two intact satellites. Iridium 33 and Cosmos 2251 collided at 11.7 km/s, creating thousands of debris fragments.",
    type: "conjunction",
    kpIndex: 1.7,
    solarWindSpeed: 340,
    bzComponent: 2.1,
    stormLevel: "none"
  },
  {
    id: "x93-flare-2017",
    name: "X9.3 Solar Flare",
    date: new Date("2017-09-06T00:00:00Z"),
    description:
      "Strongest solar flare of Solar Cycle 24. Caused R3 radio blackout, S1 radiation storm, and moderate geomagnetic storming.",
    type: "solar_storm",
    kpIndex: 8,
    solarWindSpeed: 780,
    bzComponent: -31,
    stormLevel: "severe"
  },
  {
    id: "starlink-deorbit-2022",
    name: "Starlink Mass Deorbit - 40 Satellites Lost",
    date: new Date("2022-02-04T00:00:00Z"),
    description:
      "Geomagnetic storm increased atmospheric drag, causing 40 newly launched Starlink satellites to deorbit. The storm heated and expanded the thermosphere.",
    type: "satellite_loss",
    kpIndex: 5.7,
    solarWindSpeed: 620,
    bzComponent: -18,
    stormLevel: "moderate"
  },
  {
    id: "mothers-day-storm-2025",
    name: "Mother's Day Storm - Kp 8",
    date: new Date("2025-05-12T00:00:00Z"),
    description:
      "Severe geomagnetic storm with aurora visible across most of the northern hemisphere. Multiple satellite operators reported anomalies.",
    type: "solar_storm",
    kpIndex: 8,
    solarWindSpeed: 920,
    bzComponent: -38,
    stormLevel: "severe"
  }
];
