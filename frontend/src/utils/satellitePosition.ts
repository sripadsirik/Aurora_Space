import { Cartesian3 } from "cesium";
import type { Satellite } from "../types/space";
import { getSatellitePositionOnOrbit } from "./orbit";
import { propagatedPosition } from "./propagation";

/** Live feeds are Earth-fixed snapshots. Only sample data uses synthetic orbits. */
export const satelliteSnapshotPosition = (satellite: Satellite, live: boolean): Cartesian3 => live
  ? propagatedPosition(satellite) ?? Cartesian3.fromDegrees(satellite.lon, satellite.lat, satellite.altitudeKm * 1000)
  : getSatellitePositionOnOrbit(satellite);
