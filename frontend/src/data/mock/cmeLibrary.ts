import type { MockCME } from "../../types/space";

export const mockCMEs: MockCME[] = [
  {
    id: 0,
    label: "CME-2026-A",
    startTime: "2026-03-07 14:23 UTC",
    speed: 1250,
    arrivalTime: "2026-03-09 18:00 UTC",
    hoursUntilArrival: 8,
    predictedKp: 7,
    stormLevel: "G3",
    confidence: 72,
    direction: "Earth-directed",
    impactStatus: "DIRECT HIT"
  },
  {
    id: 1,
    label: "CME-2026-B",
    startTime: "2026-03-06 09:11 UTC",
    speed: 780,
    arrivalTime: "2026-03-10 22:00 UTC",
    hoursUntilArrival: 52,
    predictedKp: 5,
    stormLevel: "G1",
    confidence: 58,
    direction: "Glancing blow — 38° off axis",
    impactStatus: "GLANCING BLOW"
  },
  {
    id: 2,
    label: "CME-2026-C",
    startTime: "2026-03-08 02:45 UTC",
    speed: 2100,
    arrivalTime: "2026-03-09 08:00 UTC",
    hoursUntilArrival: -2,
    predictedKp: 8,
    stormLevel: "G4",
    confidence: 89,
    direction: "Direct hit",
    impactStatus: "DIRECT HIT"
  },
  {
    id: 3,
    label: "CME-2026-D",
    startTime: "2026-03-08 19:30 UTC",
    speed: 890,
    arrivalTime: "2026-03-11 06:00 UTC",
    hoursUntilArrival: 36,
    predictedKp: 0,
    stormLevel: "None",
    confidence: 91,
    direction: "Venus-directed — Earth miss",
    impactStatus: "NO IMPACT — MISS",
    azimuthFromEarth: 127,
    note: "Directed toward Venus. No Earth impact expected."
  }
];
