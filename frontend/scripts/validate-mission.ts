import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cpus, totalmem, platform, arch, release } from "node:os";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { sgp4, twoline2satrec } from "satellite.js";
import refs from "../src/mission/fixtures/vallado.json";
import { parseOMM } from "../src/utils/omm";
import { demoScenario } from "../src/mission/scenario";
import { analyzeMission, MODEL_VERSION } from "../src/mission/analysis";
import { createArchive, engineeringReport } from "../src/mission/archive";
import {
  propagateState,
  MU,
  EARTH_RADIUS,
  specificEnergy,
} from "../src/mission/dynamics";
import { norm, sub } from "../src/mission/math";
import type { Vec3 } from "../src/mission/types";
const output = resolve(process.cwd(), "../docs/generated");
mkdirSync(output, { recursive: true });
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.ceil(values.length * p) - 1)
  ];
const stats = (values: number[]) => ({
  samples: values.length,
  p50Ms: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  p99Ms: percentile(values, 0.99),
  minMs: Math.min(...values),
  maxMs: Math.max(...values),
});
const referenceResults = refs.cases.map((c) => {
  let maxPositionM = 0,
    maxVelocityMs = 0,
    maxOMMPositionM = 0;
  const tle = twoline2satrec(...(c.tle as [string, string])),
    omm = parseOMM(c.omm).record;
  for (const sample of c.samples) {
    const s = sgp4(tle, sample.seconds / 60)!,
      o = sgp4(omm, sample.seconds / 60)!;
    maxPositionM = Math.max(
      maxPositionM,
      1000 *
        norm(sub([s.position.x, s.position.y, s.position.z], sample.r as Vec3)),
    );
    maxVelocityMs = Math.max(
      maxVelocityMs,
      1000 *
        norm(sub([s.velocity.x, s.velocity.y, s.velocity.z], sample.v as Vec3)),
    );
    maxOMMPositionM = Math.max(
      maxOMMPositionM,
      1000 *
        norm(sub([o.position.x, o.position.y, o.position.z], sample.r as Vec3)),
    );
  }
  if (maxPositionM > 0.01 || maxVelocityMs > 1e-5 || maxOMMPositionM > 1)
    throw new Error(`Reference tolerance failed: ${c.id}`);
  return {
    noradId: c.id,
    samples: c.samples.length,
    maxPositionM,
    maxVelocityMs,
    maxOMMPositionM,
  };
});
const scenario = demoScenario();
analyzeMission(scenario);
const analysisTimes: number[] = [];
let analysis = analyzeMission(scenario);
for (let i = 0; i < 50; i++) {
  const start = performance.now();
  analysis = analyzeMission(scenario);
  analysisTimes.push(performance.now() - start);
}
const catalog = Array.from({ length: 20000 }, (_, i) =>
  twoline2satrec(refs.cases[i % 5].tle[0], refs.cases[i % 5].tle[1]),
);
const cycles: number[] = [];
let failed = 0;
for (let cycle = 0; cycle < 31; cycle++) {
  const start = performance.now();
  for (const record of catalog) if (!sgp4(record, cycle * 5)) failed++;
  if (cycle > 0) cycles.push(performance.now() - start);
}
const radius = EARTH_RADIUS + 550000,
  circular = {
    r: [radius, 0, 0] as Vec3,
    v: [0, Math.sqrt(MU / radius), 0] as Vec3,
  };
const end = propagateState(
  circular,
  2 * Math.PI * Math.sqrt(radius ** 3 / MU),
  5,
  "two-body",
);
const hardware = {
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  memoryGB: totalmem() / 2 ** 30,
  os: `${platform()} ${release()} ${arch()}`,
  node: process.version,
};
let commit = "unavailable";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {}
const report = {
  schema: "aurora-validation-v1",
  generatedAt: new Date().toISOString(),
  modelVersion: MODEL_VERSION,
  baseCommit: commit,
  workingTree: "Local working tree; source changes may be uncommitted",
  hardware,
  references: {
    source: refs.source,
    archiveSha256: refs.archiveSha256,
    frame: "TEME",
    results: referenceResults,
  },
  analyticOrbit: {
    closureErrorM: norm(sub(end.r, circular.r)),
    relativeEnergyError: Math.abs(
      specificEnergy(end) / specificEnergy(circular) - 1,
    ),
  },
  mission: {
    candidateCount: analysis.candidates.length,
    screeningObjects: scenario.screeningObjects.length,
    baselinePc: analysis.encounter.pc,
    quadratureDifference: analysis.encounter.integrationError,
    coastMissM: analysis.candidates[0].missDistanceM,
    maximumCandidateMissM: Math.max(
      ...analysis.candidates.map((c) => c.missDistanceM),
    ),
    latency: stats(analysisTimes),
  },
  propagationBenchmark: {
    scope:
      "20,000 synthetic catalog entries repeating five published reference element sets; propagation only, no Kafka/network/rendering",
    objects: catalog.length,
    cycles: cycles.length,
    failed,
    latency: stats(cycles),
    objectsPerSecondAtP50: catalog.length / (percentile(cycles, 0.5) / 1000),
  },
  memory: process.memoryUsage(),
  limitations: [
    "Reference agreement is not observational accuracy.",
    "These timings describe this machine and workload only.",
    "Frontend rendering and gateway throughput are measured separately.",
    "Candidate Pc requires full state covariance and explicit burn execution uncertainty; linearized propagation only.",
  ],
};
writeFileSync(
  resolve(output, "mission-validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  resolve(output, "candidate-states.json"),
  JSON.stringify(
    {
      scenario,
      analysis: {
        ...analysis,
        candidates: analysis.candidates.map(
          ({ samples, ...candidate }) => candidate,
        ),
      },
    },
    null,
    2,
  ) + "\n",
);
const archive = await createArchive(
  scenario,
  "Bundled reproducible demonstration. Synthetic crossing encounter.",
  "coast",
  -scenario.config.burnLeadSeconds,
);
writeFileSync(
  resolve(process.cwd(), "public/scenarios/pathfinder.json"),
  JSON.stringify(archive, null, 2) + "\n",
);
writeFileSync(
  resolve(output, "example-engineering-report.md"),
  engineeringReport(scenario, analysis, archive.notes) + "\n",
);
console.log(JSON.stringify(report, null, 2));
