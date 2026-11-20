import { create } from "zustand";
export const useEvents = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: new URLSearchParams(location.search).has("events"),
  setOpen: (open) => set({ open }),
}));
