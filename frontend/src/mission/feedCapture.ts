import { create } from "zustand";
import { parseFeedMessage } from "../utils/parseFeedMessage";
export interface FeedEvent {
  sequence: number;
  receivedAt: string;
  message: unknown;
}
interface CaptureState {
  paused: boolean;
  recording: boolean;
  events: FeedEvent[];
  bytes: number;
  notice: string;
  setPaused: (paused: boolean) => void;
  start: () => void;
  stop: () => void;
  append: (message: unknown) => void;
}
const MAX_BYTES = 20_000_000,
  MAX_EVENTS = 300;
export const useFeedCapture = create<CaptureState>((set, get) => ({
  paused: false,
  recording: false,
  events: [],
  bytes: 0,
  notice: "",
  setPaused: (paused) => set({ paused }),
  start: () => set({ recording: true, events: [], bytes: 0, notice: "" }),
  stop: () => set({ recording: false }),
  append: (message) => {
    const state = get();
    if (!state.recording) return;
    const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
    if (state.bytes + bytes > MAX_BYTES || state.events.length >= MAX_EVENTS) {
      set({
        recording: false,
        notice:
          "Capture limit reached; recording stopped with existing events preserved.",
      });
      return;
    }
    set({
      events: [
        ...state.events,
        {
          sequence: state.events.length,
          receivedAt: new Date().toISOString(),
          message,
        },
      ],
      bytes: state.bytes + bytes,
    });
  },
}));
export function validateCapture(value: unknown): FeedEvent[] {
  if (!Array.isArray(value) || value.length > MAX_EVENTS)
    throw new Error("Invalid feed capture");
  return value.map((event, i) => {
    if (
      !event ||
      event.sequence !== i ||
      typeof event.receivedAt !== "string" ||
      !Number.isFinite(Date.parse(event.receivedAt)) ||
      !parseFeedMessage(event.message)
    )
      throw new Error(`Invalid captured event ${i}`);
    return event as FeedEvent;
  });
}
/** Folding up to a sequence uses only captured input, never wall-clock time. */
export function replayFeeds(events: FeedEvent[], sequence: number) {
  const state: {
    satellites?: unknown;
    conjunctions?: unknown;
    spaceWeather?: unknown;
    asOf?: string;
  } = {};
  for (const e of events) {
    if (e.sequence > sequence) break;
    const m = parseFeedMessage(e.message);
    if (!m) throw new Error("Invalid replay event");
    state[m.type] = m.payload;
    state.asOf = e.receivedAt;
  }
  return state;
}
