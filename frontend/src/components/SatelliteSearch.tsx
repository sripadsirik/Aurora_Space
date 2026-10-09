import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuroraStore } from "../store/auroraStore";
import type { Satellite } from "../types/space";
import { searchCatalog } from "../utils/catalogFilters";

export const SatelliteSearch = (): JSX.Element => {
  const satellites = useAuroraStore((state) => state.satellites);
  const setSelectedSatellite = useAuroraStore((state) => state.setSelectedSatellite);
  const setMode = useAuroraStore((state) => state.setMode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const results = useMemo(() => searchCatalog(satellites, query).slice(0, 12), [satellites, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select") !== null);
      if (event.key === "/" && !editing) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      setQuery("");
      searchButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  const select = (satellite: Satellite) => {
    setMode("OPS");
    setSelectedSatellite(satellite);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={searchButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search satellites, shortcut slash"
        title="Search satellites (/)"
        className="ml-1 flex min-w-10 items-center justify-center rounded border border-cyan-400/20 px-2 text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-400/10"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      </button>

      {open && createPortal((
        <div className="fixed inset-0 z-[150] flex items-start justify-center bg-black/70 px-3 pt-[min(16vh,8rem)] backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-label="Search satellites" className="w-full max-w-xl overflow-hidden rounded border border-cyan-400/40 bg-[#071626] font-mono shadow-[0_24px_80px_rgba(0,0,0,0.65)]" onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, button"));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="text-cyan-300" aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results[0]) select(results[0]);
                }}
                placeholder="Search name or NORAD ID"
                aria-label="Search name or NORAD ID"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7b9ab2]"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close satellite search" className="rounded border border-white/20 px-2 py-1 text-xs text-[#b8d5e9] hover:text-white">ESC</button>
            </div>
            <div className="max-h-[min(55vh,26rem)] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-5 text-center text-xs text-[#9bbbd2]">No satellites found.</p>
              ) : results.map((satellite) => (
                <button
                  key={satellite.noradId}
                  type="button"
                  onClick={() => select(satellite)}
                  className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-xs text-[#d8ebff] hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none"
                >
                  <span className="min-w-0 truncate">{satellite.name}</span>
                  <span className="shrink-0 text-[#7fa7c4]">{satellite.orbitType} · #{satellite.noradId}</span>
                </button>
              ))}
            </div>
            <p className="border-t border-white/10 px-4 py-2 text-[10px] text-[#7b9ab2]">{satellites.length} tracked · Enter selects the first result</p>
          </section>
        </div>
      ), document.body)}
    </>
  );
};
