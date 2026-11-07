import { it, expect } from "vitest";
import {
  createArchive,
  readArchive,
  validateScenario,
  canonical,
} from "../archive";
import { demoScenario } from "../scenario";
import { analyzeMission } from "../analysis";
import { replayFeeds, validateCapture, useFeedCapture } from "../feedCapture";
it("round trips a hashed session and recomputes identical analysis", async () => {
  const s = demoScenario(),
    a = await createArchive(s, "Keep this rationale", "coast", -100);
  const b = await readArchive(JSON.stringify(a));
  expect(b.notes).toBe("Keep this rationale");
  expect(canonical(analyzeMission(b.scenario))).toBe(
    canonical(analyzeMission(s)),
  );
  const tampered = { ...a, notes: "changed" };
  await expect(readArchive(JSON.stringify(tampered))).rejects.toThrow(
    "checksum",
  );
});
it("rejects impossible configurations before worker computation", () => {
  const s = demoScenario();
  expect(() =>
    validateScenario({ ...s, config: { ...s.config, stepSeconds: 0 } }),
  ).toThrow();
  expect(() =>
    validateScenario({ ...s, primary: { ...s.primary, radiusM: -1 } }),
  ).toThrow();
  expect(() => validateScenario({ ...s, secondary: s.primary })).toThrow(
    "unique",
  );
});
it("replay uses recorded order and timestamps, with bounded recording", () => {
  const events = validateCapture([
    {
      sequence: 0,
      receivedAt: "2026-10-26T00:00:00Z",
      message: { type: "satellites", payload: [] },
    },
    {
      sequence: 1,
      receivedAt: "2026-10-26T00:00:01Z",
      message: { type: "conjunctions", payload: [] },
    },
  ]);
  expect(replayFeeds(events, 0).conjunctions).toBeUndefined();
  expect(replayFeeds(events, 1).conjunctions).toEqual([]);
  useFeedCapture.getState().start();
  for (let i = 0; i < 301; i++)
    useFeedCapture.getState().append({ type: "satellites", payload: [] });
  expect(useFeedCapture.getState().recording).toBe(false);
  expect(useFeedCapture.getState().events).toHaveLength(300);
});
