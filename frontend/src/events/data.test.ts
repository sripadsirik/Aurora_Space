import { describe, it, expect } from "vitest";
import {
  countdown,
  nextRace,
  samplePosition,
  weekend,
  type Race,
} from "./data";
import {
  align,
  transform,
  circuitPosition,
  carHeading,
  type XY,
} from "./alignment";
const race = {
  date: "2026-11-22",
  time: "04:00:00Z",
  FirstPractice: { date: "2026-11-20", time: "00:30:00Z" },
  SprintQualifying: { date: "2026-11-20", time: "04:00:00Z" },
  Sprint: { date: "2026-11-21", time: "00:30:00Z" },
  Qualifying: { date: "2026-11-21", time: "04:00:00Z" },
} as Race;
describe("F1 weekend chronology", () => {
  it("keeps overnight UTC dates and sprint sessions in timestamp order", () => {
    const s = weekend(race);
    expect(s.map((x) => x.name)).toEqual([
      "Practice 1",
      "Sprint Qualifying",
      "Sprint",
      "Qualifying",
      "Race",
    ]);
    expect(s.at(-1)?.start).toBe("2026-11-22T04:00:00Z");
  });
  it("does not invent unpublished session times", () =>
    expect(weekend({ ...race, time: undefined }).at(-1)?.confirmed).toBe(
      false,
    ));
  it("rolls to the next future race and clamps elapsed countdowns", () => {
    expect(
      nextRace([race], Date.parse("2026-11-22T04:00:01Z")),
    ).toBeUndefined();
    expect(
      countdown("2026-11-22T04:00:00Z", Date.parse("2026-11-21T02:58:57Z")),
    ).toBe("1d 01h 01m 03s");
    expect(countdown("2020-01-01", Date.now())).toBe("0d 00h 00m 00s");
  });
  it("interpolates positions but hides stale samples and gaps", () => {
    const p = [
      { driver_number: 1, date: "2026-01-01T00:00:00Z", x: 0, y: 10 },
      { driver_number: 1, date: "2026-01-01T00:00:01Z", x: 10, y: 20 },
    ];
    expect(samplePosition(p, Date.parse(p[0].date) + 500)).toEqual([5, 15]);
    expect(samplePosition(p, Date.parse(p[1].date) + 3000)).toBeNull();
    expect(samplePosition(p, Date.parse(p[0].date) - 1)).toBeNull();
  });
});
describe("Telemetry to Earth registration", () => {
  it("recovers an arbitrary rotated, translated telemetry frame", () => {
    const track: XY[] = Array.from({ length: 100 }, (_, i) => {
      const a = (i * Math.PI * 2) / 99;
      return [Math.cos(a) * 1000 + Math.cos(3 * a) * 170, Math.sin(a) * 600];
    });
    const original = {
      scale: 0.1,
      angle: 0.7,
      tx: 1550,
      ty: -800,
      error: 0,
      reflection: 1,
    };
    const samples: XY[] = track.map(([x, y]) => {
      const px = x - original.tx,
        py = y - original.ty;
      return [
        (Math.cos(0.7) * px + Math.sin(0.7) * py) / 0.1,
        (-Math.sin(0.7) * px + Math.cos(0.7) * py) / 0.1,
      ];
    });
    const fit = align(samples, track);
    expect(fit).not.toBeNull();
    expect(fit!.error).toBeLessThan(30);
    const p = transform(samples[20], fit!);
    expect(Math.hypot(p[0] - track[20][0], p[1] - track[20][1])).toBeLessThan(
      80,
    );
  });
  it("refuses insufficient or degenerate data", () => {
    expect(align([[0, 0]], [[0, 0]])).toBeNull();
    expect(align(Array(40).fill([0, 0]), Array(20).fill([1, 1]))).toBeNull();
  });
});

it("keeps the car nose tangent through a right-angle turn and holds heading at rest", () => {
  const circuit: XY[] = [
    [0, 0],
    [50, 0],
    [50, 50],
  ];
  expect(circuitPosition([20, 3], circuit, 6)).toEqual([20, 0]);
  expect(circuitPosition([48, 20], circuit, 6)).toEqual([50, 20]);
  expect(circuitPosition([12, 20], circuit, 6)).toEqual([12, 20]);
  for (const [east, north] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    const h = carHeading(east, north, 0);
    expect(Math.cos(-h)).toBeCloseTo(east);
    expect(Math.sin(-h)).toBeCloseTo(north);
  }
  expect(carHeading(0, 0, 1.2)).toBe(1.2);
});
