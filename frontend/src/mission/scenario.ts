import { EARTH_RADIUS, MU } from "./dynamics";
import type { MissionObject, MissionScenario } from "./types";

/** Deliberately synthetic crossing geometry, fixed epoch and no random inputs. */
export function demoScenario(): MissionScenario {
  const r = EARTH_RADIUS + 550000,
    v = Math.sqrt(MU / r),
    angle = (55 * Math.PI) / 180;
  const primary: MissionObject = {
    id: "SIM-001",
    name: "AURORA / Pathfinder",
    state: { r: [r, 0, 0], v: [0, v, 0] },
    covariance: [
      [3600, 0, 0],
      [0, 14400, 0],
      [0, 0, 1600],
    ],
    radiusM: 4,
  };
  const secondary: MissionObject = {
    id: "SIM-002",
    name: "Fragment / K-17",
    state: {
      r: [r + 85, 0, 0],
      v: [0, v * Math.cos(angle), v * Math.sin(angle)],
    },
    covariance: [
      [6400, 0, 0],
      [0, 22500, 0],
      [0, 0, 2500],
    ],
    radiusM: 2,
  };
  for (const object of [primary, secondary]) {
    object.stateCovariance = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) =>
        i < 3 && j < 3 ? object.covariance[i][j] : i === j ? 0.0004 : 0,
      ),
    );
  }
  return {
    schema: "aurora-mission-v1",
    id: "pathfinder-crossing-001",
    name: "The 85-metre encounter",
    description:
      "A synthetic LEO crossing at 550 km. Investigate the uncertainty, then compare an impulse 45 minutes before closest approach.",
    kind: "synthetic",
    epoch: "2026-10-26T12:00:00.000Z",
    frame: "GCRF",
    primary,
    secondary,
    screeningObjects: [
      {
        id: "SIM-003",
        name: "AURORA / Companion",
        state: { r: [r, 25000, 5000], v: [-25, v, 0] },
        covariance: [
          [10000, 0, 0],
          [0, 10000, 0],
          [0, 0, 10000],
        ],
        radiusM: 4,
      },
      {
        id: "SIM-004",
        name: "Fragment / M-08",
        state: { r: [r + 40000, -10000, -20000], v: [0, v * 0.8, v * 0.6] },
        covariance: [
          [10000, 0, 0],
          [0, 10000, 0],
          [0, 0, 10000],
        ],
        radiusM: 1,
      },
    ],
    source: {
      name: "AURORA deterministic fixture",
      reference:
        "Synthetic states constructed in mission/scenario.ts; no real spacecraft event is represented.",
      capturedAt: "2026-10-26T10:00:00.000Z",
    },
    revisions: [
      {
        id: "SIM-R1",
        issuedAt: "2026-10-25T12:00:00.000Z",
        missDistanceM: 420,
        suppliedPc: 0.000012,
      },
      {
        id: "SIM-R2",
        issuedAt: "2026-10-26T00:00:00.000Z",
        missDistanceM: 210,
        suppliedPc: 0.00009,
      },
      {
        id: "SIM-R3",
        issuedAt: "2026-10-26T06:00:00.000Z",
        missDistanceM: 85,
        suppliedPc: null,
      },
    ],
    config: {
      stepSeconds: 10,
      burnLeadSeconds: 2700,
      encounterWindowSeconds: 180,
      maxDeltaVMs: 1,
      screeningDistanceM: 5000,
      massKg: 300,
      ispSeconds: 1600,
      forceModel: "J2",
      burnExecutionSigmaMs: 0.01,
    },
  };
}
