import { Billboard, Cartesian3, Model, Transforms, type Viewer } from "cesium";
import type { Satellite } from "../../types/space";
import { objectClassification } from "../../utils/objectType";
export function catalogModelKind(s: Satellite) {
  const type = objectClassification(s).label;
  return s.noradId === 25544
    ? "station"
    : type === "Rocket body"
      ? "rocket"
      : type === "Debris"
        ? "debris"
        : "satellite";
}
/** Keep a bounded set of detailed meshes near the camera; distant objects use silhouettes. */
export function installCatalogModels(viewer: Viewer) {
  const models = new Map<
    number,
    { model?: Model; state: { point: Billboard; satellite: Satellite } }
  >();
  let disposed = false,
    lastScan = 0;
  return {
    update(
      states: { point: Billboard; satellite: Satellite }[],
      enabled: boolean,
    ) {
      if (performance.now() - lastScan > 750) {
        lastScan = performance.now();
        const nearest = enabled
          ? states
              .filter(
                (s) =>
                  s.point.show &&
                  Cartesian3.distanceSquared(
                    s.point.position,
                    viewer.camera.positionWC,
                  ) <
                    300000 ** 2,
              )
              .sort(
                (a, b) =>
                  Cartesian3.distanceSquared(
                    a.point.position,
                    viewer.camera.positionWC,
                  ) -
                  Cartesian3.distanceSquared(
                    b.point.position,
                    viewer.camera.positionWC,
                  ),
              )
              .slice(0, 32)
          : [];
        const keep = new Set(nearest.map((s) => s.satellite.noradId));
        for (const [id, entry] of models)
          if (!keep.has(id)) {
            if (entry.model) viewer.scene.primitives.remove(entry.model);
            models.delete(id);
          }
        for (const state of nearest) {
          const id = state.satellite.noradId;
          if (models.has(id)) {
            models.get(id)!.state = state;
            continue;
          }
          const entry: { model?: Model; state: typeof state } = { state };
          models.set(id, entry);
          void Model.fromGltfAsync({
            url:
              import.meta.env.BASE_URL +
              `models/${catalogModelKind(state.satellite)}.glb`,
            modelMatrix: Transforms.eastNorthUpToFixedFrame(
              state.point.position,
            ),
            minimumPixelSize: 28,
            id: { type: "satellite", satellite: state.satellite },
          })
            .then((model) => {
              if (disposed || models.get(id) !== entry) {
                model.destroy();
                return;
              }
              entry.model = viewer.scene.primitives.add(model);
            })
            .catch(() => {
              if (models.get(id) === entry) models.delete(id);
            });
        }
      }
      for (const entry of models.values())
        if (entry.model) {
          entry.model.show = enabled && entry.state.point.show;
          entry.model.modelMatrix = Transforms.eastNorthUpToFixedFrame(
            entry.state.point.position,
          );
          if (entry.model.ready && entry.model.show)
            entry.state.point.show = false;
        }
    },
    dispose() {
      disposed = true;
      for (const e of models.values())
        if (e.model) viewer.scene.primitives.remove(e.model);
      models.clear();
    },
  };
}
