import { Cartesian3, Ellipsoid, IntersectionTests, Ray } from "cesium";

/** Tests the finite camera-to-object segment against the Earth ellipsoid. */
export class GlobeOcclusion {
  private readonly ray = new Ray();

  constructor(
    private readonly ellipsoid: Ellipsoid,
    public cameraPosition: Cartesian3,
  ) {}

  isPointVisible(position: Cartesian3): boolean {
    Cartesian3.subtract(position, this.cameraPosition, this.ray.direction);
    const distance = Cartesian3.magnitude(this.ray.direction);
    if (!Number.isFinite(distance)) return false;
    if (distance < 0.01) return true;
    Cartesian3.clone(this.cameraPosition, this.ray.origin);
    Cartesian3.divideByScalar(this.ray.direction, distance, this.ray.direction);
    const intersection = IntersectionTests.rayEllipsoid(this.ray, this.ellipsoid);
    return !intersection || intersection.stop <= 0 || intersection.start >= distance - 0.01;
  }
}
