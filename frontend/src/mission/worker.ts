import { analyzeMission } from "./analysis";
import { validateScenario } from "./archive";
self.onmessage = (event: MessageEvent) => {
  const { id, scenario } = event.data;
  try {
    const start = performance.now();
    const analysis = analyzeMission(validateScenario(scenario));
    self.postMessage({ id, analysis, durationMs: performance.now() - start });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Analysis failed",
    });
  }
};
