import type { Satellite, RiskLevel, OrbitType } from "../../types/space";

interface BaseSatelliteSpec {
  noradId: number;
  name: string;
  owner: string;
  orbitType: OrbitType;
  altitudeKm: number;
}

const prng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rng = prng(7331);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const orbitVelocity = (orbitType: OrbitType, altitudeKm: number): number => {
  if (orbitType === "LEO") {
    const base = 7.85 - altitudeKm * 0.0005;
    return Number(clamp(base + (rng() - 0.5) * 0.08, 7.2, 8.0).toFixed(3));
  }

  if (orbitType === "MEO") {
    const base = 4.2 - altitudeKm * 0.00002;
    return Number(clamp(base + (rng() - 0.5) * 0.06, 3.5, 4.5).toFixed(3));
  }

  return Number(clamp(3.07 + (rng() - 0.5) * 0.03, 2.95, 3.1).toFixed(3));
};

const jitter = (span: number): number => (rng() - 0.5) * span;

const createStarlinkSpecs = (): BaseSatelliteSpec[] => {
  const specs: BaseSatelliteSpec[] = [];
  for (let index = 0; index < 50; index += 1) {
    specs.push({
      noradId: 57000 + index,
      name: `STARLINK-${1200 + index}`,
      owner: "SpaceX",
      orbitType: "LEO",
      altitudeKm: Number((540 + (index % 8) * 4 + jitter(6)).toFixed(1))
    });
  }
  return specs;
};

const debrisNames = [
  "FENGYUN-1C-DEB",
  "COSMOS-2251-DEB",
  "IRIDIUM-33-DEB",
  "SL-16-R/B-DEB",
  "ARIANE-44LP-DEB",
  "CZ-4C-DEB",
  "NOAA-17-DEB",
  "DELTA-2-DEB",
  "PROTON-K-DEB",
  "MOLNIYA-DEB",
  "METEOR-DEB",
  "RESURS-DEB",
  "TIROS-DEB",
  "COSMOS-DEB-14",
  "COSMOS-DEB-15",
  "COSMOS-DEB-16",
  "COSMOS-DEB-17",
  "COSMOS-DEB-18",
  "COSMOS-DEB-19",
  "COSMOS-DEB-20"
];

const createDebrisSpecs = (): BaseSatelliteSpec[] =>
  debrisNames.map((name, index) => ({
    noradId: 89000 + index,
    name,
    owner: "DEBRIS",
    orbitType: index % 5 === 0 ? "GEO" : "LEO",
    altitudeKm:
      index % 5 === 0
        ? Number((35786 + jitter(40)).toFixed(1))
        : Number((650 + (index % 6) * 22 + jitter(12)).toFixed(1))
  }));

const mixedTemplates: Array<{ prefix: string; owner: string; orbitType: OrbitType; altitudeRange: [number, number] }> = [
  { prefix: "COSMOS", owner: "ROSCOSMOS", orbitType: "LEO", altitudeRange: [500, 980] },
  { prefix: "GAOFEN", owner: "CNSA", orbitType: "LEO", altitudeRange: [520, 900] },
  { prefix: "GALILEO", owner: "ESA", orbitType: "MEO", altitudeRange: [23200, 23300] },
  { prefix: "GPS", owner: "NASA", orbitType: "MEO", altitudeRange: [20180, 20320] },
  { prefix: "QZS", owner: "CNSA", orbitType: "GEO", altitudeRange: [35770, 35820] },
  { prefix: "TIANGONG-SAT", owner: "CNSA", orbitType: "LEO", altitudeRange: [380, 430] },
  { prefix: "SENTINEL", owner: "ESA", orbitType: "LEO", altitudeRange: [700, 790] },
  { prefix: "LANDSAT", owner: "NASA", orbitType: "LEO", altitudeRange: [690, 730] }
];

const createMixedSpecs = (): BaseSatelliteSpec[] => {
  const specs: BaseSatelliteSpec[] = [
    {
      noradId: 25544,
      name: "ISS",
      owner: "NASA",
      orbitType: "LEO",
      altitudeKm: 418.4
    },
    {
      noradId: 22675,
      name: "COSMOS-2251",
      owner: "ROSCOSMOS",
      orbitType: "LEO",
      altitudeKm: 790.2
    }
  ];

  let norad = 30000;
  while (specs.length < 80) {
    const template = mixedTemplates[specs.length % mixedTemplates.length];
    const altitudeKm = Number(
      (
        template.altitudeRange[0] +
        rng() * (template.altitudeRange[1] - template.altitudeRange[0])
      ).toFixed(1)
    );

    specs.push({
      noradId: norad,
      name: `${template.prefix}-${100 + specs.length}`,
      owner: template.owner,
      orbitType: template.orbitType,
      altitudeKm
    });

    norad += 1;
  }

  return specs;
};

const baseSpecs: BaseSatelliteSpec[] = [
  ...createMixedSpecs(),
  ...createStarlinkSpecs(),
  ...createDebrisSpecs()
];

if (baseSpecs.length !== 150) {
  throw new Error(`Expected 150 satellites, got ${baseSpecs.length}`);
}

const riskPool: RiskLevel[] = [
  ...new Array<RiskLevel>(3).fill("critical"),
  ...new Array<RiskLevel>(8).fill("warning"),
  ...new Array<RiskLevel>(20).fill("watch"),
  ...new Array<RiskLevel>(119).fill("nominal")
];

const riskPriorityNames = [
  "FENGYUN-1C-DEB",
  "COSMOS-2251-DEB",
  "STARLINK-1207",
  "ISS",
  "COSMOS-2251"
];

const assignedRisk = new Map<number, RiskLevel>();
for (const name of riskPriorityNames) {
  const target = baseSpecs.find((spec) => spec.name === name);
  if (!target) {
    continue;
  }

  const risk = riskPool.shift();
  if (risk) {
    assignedRisk.set(target.noradId, risk);
  }
}

for (const spec of baseSpecs) {
  if (assignedRisk.has(spec.noradId)) {
    continue;
  }

  const risk = riskPool.shift();
  if (!risk) {
    break;
  }

  assignedRisk.set(spec.noradId, risk);
}

const createLat = (index: number): number =>
  Number(clamp(-75 + ((index * 17.23) % 150) + jitter(8), -89.5, 89.5).toFixed(3));

const createLon = (index: number): number =>
  Number(clamp(-179 + ((index * 29.71) % 358) + jitter(14), -180, 180).toFixed(3));

const createConjunctionCount = (riskLevel: RiskLevel): number => {
  if (riskLevel === "critical") {
    return 3;
  }

  if (riskLevel === "warning") {
    return rng() > 0.35 ? 2 : 3;
  }

  if (riskLevel === "watch") {
    return rng() > 0.5 ? 1 : 2;
  }

  return rng() > 0.82 ? 1 : 0;
};

export const mockSatellites: Satellite[] = baseSpecs.map((spec, index) => {
  const riskLevel = assignedRisk.get(spec.noradId) ?? "nominal";

  return {
    noradId: spec.noradId,
    name: spec.name,
    owner: spec.owner,
    orbitType: spec.orbitType,
    altitudeKm: spec.altitudeKm,
    lat: createLat(index),
    lon: createLon(index),
    velocityKms: orbitVelocity(spec.orbitType, spec.altitudeKm),
    riskLevel,
    conjunctionCount: createConjunctionCount(riskLevel)
  };
});

export const satelliteRiskSummary = mockSatellites.reduce(
  (summary, satellite) => {
    summary[satellite.riskLevel] += 1;
    return summary;
  },
  {
    nominal: 0,
    watch: 0,
    warning: 0,
    critical: 0
  }
);
