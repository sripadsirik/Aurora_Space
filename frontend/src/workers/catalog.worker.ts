import type { Satellite } from "../types/space";
import { propagateCatalogWindow } from "../utils/catalogPropagation";

let catalog: Satellite[] = [];
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
function sample() {
  const window = propagateCatalogWindow(catalog, Date.now(), generation);
  self.postMessage(window, { transfer: [window.positions.buffer] });
  // Work completes before scheduling again; slow devices never build a task queue.
  timer = setTimeout(sample, 1000);
}
self.onmessage = (event: MessageEvent<{ satellites: Satellite[]; generation: number }>) => {
  clearTimeout(timer);
  catalog = event.data.satellites;
  generation = event.data.generation;
  sample();
};
