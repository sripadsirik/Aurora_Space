import { create } from "zustand";
import type { Viewer } from "cesium";

export const useEvents = create<{
  open: boolean;
  details: boolean;
  viewer: Viewer | null;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: new URLSearchParams(location.search).has("events"),
  details: new URLSearchParams(location.search).get("events") === "1",
  viewer: null,
  setOpen: (open) => set({ open, details: false }),
}));
