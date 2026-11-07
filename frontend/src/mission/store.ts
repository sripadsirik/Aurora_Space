import { create } from "zustand";
import type { FeedEvent } from "./feedCapture";
import type { MissionScenario } from "./types";
import { demoScenario } from "./scenario";
interface MissionState {
  session: {
    notes: string;
    selected: string;
    seconds: number;
    hash: string;
    importedEvents: FeedEvent[] | null;
    tab: "encounter" | "maneuvers" | "evidence";
  } | null;
  open: boolean;
  scenario: MissionScenario;
  launch: (scenario?: MissionScenario) => void;
  close: () => void;
}
export const useMissionStore = create<MissionState>((set) => ({
  open:
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("mission"),
  scenario: demoScenario(),
  session: null,
  launch: (scenario) =>
    set((s) => ({
      open: true,
      scenario: scenario ?? s.scenario,
      session: scenario && scenario.id !== s.scenario.id ? null : s.session,
    })),
  close: () => set({ open: false }),
}));
