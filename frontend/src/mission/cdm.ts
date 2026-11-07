import { validateStateCovariance } from "./uncertainty";
import type { ReviewReport } from "../utils/conjunctionReview";
import { demoScenario } from "./scenario";
import { rotateCovariance, rtnBasis, validateCovariance } from "./math";
import { validateScenario } from "./archive";
import type { Mat3, MissionObject, MissionScenario, Vec3 } from "./types";
function field(
  fields: Record<string, string>,
  key: string,
  unit: string,
): number {
  const text = fields[key];
  if (typeof text !== "string") throw new Error(`CDM missing ${key}`);
  const match = text.match(
    /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:\[([^\]]+)\])?\s*$/,
  );
  if (!match || !Number.isFinite(Number(match[1])))
    throw new Error(`Invalid CDM ${key}`);
  if (match[2] && match[2] !== unit)
    throw new Error(`${key} requires ${unit}, received ${match[2]}`);
  return Number(match[1]);
}
/** Supported CCSDS CDM subset: Earth-centered EME2000/GCRF states in km and km/s,
 * RTN position covariance in m², UTC TCA. No inferred frame transformations. */
export function scenarioFromCdm(
  report: ReviewReport,
  radii: [number, number],
): MissionScenario {
  const frames = report.objects.map((o) => o.fields.REF_FRAME);
  if (frames[0] !== frames[1] || !["GCRF", "EME2000"].includes(frames[0]))
    throw new Error(
      "Analysis requires both CDM state vectors in the same GCRF or EME2000 frame",
    );
  const objects = report.objects.map((o, i): MissionObject => {
    if (o.fields.ORBIT_CENTER && o.fields.ORBIT_CENTER !== "EARTH")
      throw new Error("Only Earth-centered CDMs supported");
    if (o.fields.TIME_SYSTEM && o.fields.TIME_SYSTEM !== "UTC")
      throw new Error("Only UTC supported");
    for (const key of ["COV_REF_FRAME", "COVARIANCE_REF_FRAME"])
      if (o.fields[key] && o.fields[key] !== "RTN")
        throw new Error("Only RTN CDM covariance supported");
    if (
      o.fields.EPOCH &&
      Date.parse(
        o.fields.EPOCH.endsWith("Z") ? o.fields.EPOCH : o.fields.EPOCH + "Z",
      ) !== Date.parse(report.tca)
    )
      throw new Error("CDM state epoch must equal TCA");
    const r = ["X", "Y", "Z"].map(
      (k) => field(o.fields, k, "km") * 1000,
    ) as Vec3;
    const v = ["X_DOT", "Y_DOT", "Z_DOT"].map(
      (k) => field(o.fields, k, "km/s") * 1000,
    ) as Vec3;
    const f = (k: string) => field(o.fields, k, "m**2");
    const rr = f("CR_R"),
      tr = f("CT_R"),
      tt = f("CT_T"),
      nr = f("CN_R"),
      nt = f("CN_T"),
      nn = f("CN_N");
    const rtn: Mat3 = [
      [rr, tr, nr],
      [tr, tt, nt],
      [nr, nt, nn],
    ];
    validateCovariance(rtn);
    let stateCovariance: number[][] | undefined;
    const names = ["R", "T", "N", "RDOT", "TDOT", "NDOT"];
    const velocityFields = names
      .slice(3)
      .flatMap((row, index) =>
        names.slice(0, index + 4).map((col) => `C${row}_${col}`),
      );
    const supplied = velocityFields.filter(
      (key) => o.fields[key] !== undefined,
    );
    if (supplied.length > 0 && supplied.length !== velocityFields.length)
      throw new Error(
        "Partial velocity covariance: provide all 21 state-covariance terms or position terms only",
      );
    if (supplied.length) {
      const matrix = Array.from({ length: 6 }, () => Array(6).fill(0));
      for (let row = 0; row < 6; row++)
        for (let col = 0; col <= row; col++) {
          const unit = row < 3 ? "m**2" : col < 3 ? "m**2/s" : "m**2/s**2";
          matrix[row][col] = matrix[col][row] = field(
            o.fields,
            `C${names[row]}_${names[col]}`,
            unit,
          );
        }
      validateStateCovariance(matrix);
      const basis = rtnBasis(r, v);
      const rotation = Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) =>
          Math.floor(i / 3) === Math.floor(j / 3) ? basis[j % 3][i % 3] : 0,
        ),
      );
      stateCovariance = Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => {
          let value = 0;
          for (let a = 0; a < 6; a++)
            for (let b = 0; b < 6; b++)
              value += rotation[i][a] * matrix[a][b] * rotation[j][b];
          return value;
        }),
      );
    }
    return {
      ...(stateCovariance ? { stateCovariance } : {}),
      id: o.id,
      name: o.name,
      state: { r, v },
      covariance: rotateCovariance(rtn, rtnBasis(r, v)),
      radiusM: radii[i],
    };
  });
  const template = demoScenario();
  return validateScenario({
    ...template,
    id: report.id,
    name: `${objects[0].name} / ${objects[1].name}`,
    kind: "imported",
    description:
      "Imported CDM. Hard-body radii are analyst inputs. Source states and position covariances are retained in the archive.",
    epoch: report.tca,
    frame: frames[0],
    primary: objects[0],
    secondary: objects[1],
    screeningObjects: [],
    source: {
      name: report.source,
      reference: `CDM ${report.id}; issued ${report.createdAt}; analyst radii ${radii.join(" / ")} m`,
      capturedAt: report.createdAt,
      ...(report.raw ? { raw: report.raw } : {}),
    },
    config: { ...template.config, burnExecutionSigmaMs: null },
    revisions: [
      {
        id: report.id,
        issuedAt: report.createdAt,
        missDistanceM: report.missDistanceM,
        suppliedPc: report.pc,
      },
    ],
  });
}
