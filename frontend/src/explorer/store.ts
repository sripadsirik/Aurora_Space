import { create } from "zustand";
export interface PickChoice {
  id: string;
  name: string;
  detail: string;
  select: () => void;
}
export const useExplorer = create<{
  catalogOpen: boolean;
  earthOpen: boolean;
  hover: { x: number; y: number; text: string } | null;
  choices: PickChoice[];
  set: (
    v: Partial<{
      catalogOpen: boolean;
      earthOpen: boolean;
      hover: { x: number; y: number; text: string } | null;
      choices: PickChoice[];
    }>,
  ) => void;
}>((set) => ({
  catalogOpen: false,
  earthOpen: false,
  hover: null,
  choices: [],
  set: (v) => set(v),
}));
