import { afterEach, expect, it, vi } from "vitest";
import { Cartesian3, HeadingPitchRange, Matrix4 } from "cesium";
const views = vi.hoisted(() => ({ updates: vi.fn() }));
vi.mock("cesium", async (original) => ({
  ...(await original<typeof import("cesium")>()),
  EntityView: class {
    update = views.updates;
  },
}));
import { createFollowCamera } from "./followCamera";
afterEach(() => vi.clearAllMocks());
it("initializes an orbit once, preserves manual zoom, and releases back to Earth controls", () => {
  const camera = {
    cancelFlight: vi.fn(),
    lookAt: vi.fn(),
    lookAtTransform: vi.fn(),
    setView: vi.fn(),
    position: new Cartesian3(0, -200, 100),
    heading: 0.2,
    pitch: -0.4,
  };
  const viewer = {
    camera,
    trackedEntity: undefined,
    scene: {},
    isDestroyed: () => false,
  };
  const follow = createFollowCamera(viewer as any),
    offset = new HeadingPitchRange(-0.8, -0.25, 220);
  follow.update(new Cartesian3(6371000, 0, 0), offset);
  camera.position = new Cartesian3(0, -600, 300); // Mouse wheel changed the follow distance.
  follow.update(new Cartesian3(6371000, 20, 0), offset);
  expect(camera.lookAt).toHaveBeenCalledTimes(1);
  expect(camera.position.y).toBe(-600);
  expect(views.updates).toHaveBeenCalledTimes(2);
  follow.release();
  expect(camera.lookAtTransform).toHaveBeenCalledWith(Matrix4.IDENTITY);
  expect(camera.setView).toHaveBeenCalledWith({
    orientation: { heading: 0.2, pitch: -0.4, roll: 0 },
  });
});
