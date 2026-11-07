import { expect, it } from "vitest";
import { satelliteSnapshotTime } from "../snapshotTime";
import type { Satellite } from "../../types/space";
it("uses the oldest propagation epoch instead of a later snapshot delivery time", () => {
  const rows = [
    { positionTimestamp: "2026-11-05T14:06:03Z" },
    { positionTimestamp: "2026-11-05T14:06:05Z" },
  ] as Satellite[];
  expect(satelliteSnapshotTime(rows).toISOString()).toBe(
    "2026-11-05T14:06:03.000Z",
  );
  expect(satelliteSnapshotTime(rows).getTime()).toBe(
    satelliteSnapshotTime(rows).getTime(),
  );
});
it("missing propagation times are unknown, never promoted to current", () => {
  expect(
    Number.isNaN(satelliteSnapshotTime([{}] as Satellite[]).getTime()),
  ).toBe(true);
  expect(Number.isNaN(satelliteSnapshotTime([]).getTime())).toBe(true);
});
