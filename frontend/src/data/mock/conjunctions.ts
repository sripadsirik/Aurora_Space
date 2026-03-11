import type { ConjunctionWarning } from "../../types/space";

const now = Date.now();

export const mockConjunctions: ConjunctionWarning[] = [
  {
    id: "cj-001",
    object1: { noradId: 57007, name: "STARLINK-1207" },
    object2: { noradId: 89000, name: "FENGYUN-1C-DEB" },
    tca: new Date(now + 14 * 60 * 60 * 1000),
    missDistanceKm: 0.248,
    missDistanceM: 248,
    pc: 0.0012,
    probability: 0.0012,
    relativeVelocityKms: 13.9,
    riskLevel: "critical"
  },
  {
    id: "cj-002",
    object1: { noradId: 25544, name: "ISS" },
    object2: { noradId: 22675, name: "COSMOS-2251" },
    tca: new Date(now + 14 * 60 * 60 * 1000),
    missDistanceKm: 0.612,
    missDistanceM: 612,
    pc: 0.00034,
    probability: 0.00034,
    relativeVelocityKms: 11.1,
    riskLevel: "warning"
  },
  {
    id: "cj-003",
    object1: { noradId: 57019, name: "STARLINK-1219" },
    object2: { noradId: 89001, name: "COSMOS-2251-DEB" },
    tca: new Date(now + 14 * 60 * 60 * 1000),
    missDistanceKm: 0.201,
    missDistanceM: 201,
    pc: 0.0087,
    probability: 0.0087,
    relativeVelocityKms: 14.5,
    riskLevel: "critical"
  }
];
