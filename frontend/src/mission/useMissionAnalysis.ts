import { useEffect, useState } from "react";
import type { MissionAnalysis, MissionScenario } from "./types";

type Job = {
  scenario: MissionScenario;
  attempt: number;
  analysis: MissionAnalysis | null;
  durationMs: number;
  error: string;
};

/** Results belong to the exact immutable input snapshot, never just its ID. */
export function useMissionAnalysis(scenario: MissionScenario) {
  const [attempt, setAttempt] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const current =
    job?.scenario === scenario && job.attempt === attempt ? job : null;
  useEffect(() => {
    let disposed = false;
    let worker: Worker | undefined;
    const fail = (error: string) => {
      if (!disposed)
        setJob({ scenario, attempt, analysis: null, durationMs: 0, error });
    };
    try {
      worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = ({ data }) => {
        if (disposed) return;
        if (data.error) fail(data.error);
        else
          setJob({
            scenario,
            attempt,
            analysis: data.analysis,
            durationMs: data.durationMs,
            error: "",
          });
      };
      worker.onerror = () =>
        fail("Analysis worker failed. Retry the analysis to continue.");
      worker.postMessage({ id: scenario.id, scenario });
    } catch (error) {
      fail(
        error instanceof Error
          ? error.message
          : "Unable to start the analysis worker.",
      );
    }
    return () => {
      disposed = true;
      worker?.terminate();
    };
  }, [scenario, attempt]);
  return {
    analysis: current?.analysis ?? null,
    busy: current === null,
    duration: current?.durationMs ?? 0,
    analysisError: current?.error ?? "",
    retry: () => setAttempt((n) => n + 1),
  };
}
