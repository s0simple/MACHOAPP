"use client";

import { useEffect, useRef, useState } from "react";
import type { SelectedPlace } from "@/lib/request-form-types";

interface PlaceHit {
  label: string;
  lat: number;
  lng: number;
}

interface LocationSearchProps {
  label: string;
  placeholder: string;
  selected: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  /** Called when the user clears the current selection / edits the query. */
  onClear: () => void;
}

/**
 * Debounced, authed address search backed by our /api/geo/search proxy
 * (Nominatim). Results appear in a dropdown below the input. Selecting a
 * result calls onSelect with the formatted address + coordinates so the rest
 * of the form never deals with raw lat/lng.
 */
export default function LocationSearch({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
}: LocationSearchProps) {
  const [query, setQuery] = useState(selected?.label || "");
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  async function doSearch(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setError(null);
      return;
    }

    setSearching(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        // Do not expose server detail; show a friendly message.
        setResults([]);
        setError("We couldn't search addresses right now. Please try again in a moment.");
        return;
      }
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
      setFocusedIndex(-1);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResults([]);
      setError("Search failed. Please check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    // Once the user edits the text, the previously selected place is stale.
    if (selected) onClear();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 500ms debounce — do not hit the geocoder on every keystroke.
    debounceRef.current = setTimeout(() => {
      void doSearch(value);
    }, 500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        e.preventDefault();
        pick(results[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function pick(place: PlaceHit) {
    setQuery(place.label);
    setResults([]);
    setOpen(false);
    setError(null);
    onSelect({ label: place.label, lat: place.lat, lng: place.lng });
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="label">{label}</label>

      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-secondary/40 bg-secondary/5 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground break-words">{selected.label}</p>
            <p className="text-xs text-secondary font-medium mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Location selected
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery("");
            }}
            className="text-muted hover:text-danger shrink-0"
            aria-label="Clear location"
            title="Change location"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            className="input"
            placeholder={placeholder}
            autoComplete="off"
          />
          {searching && (
            <div className="absolute right-3 top-[38px] text-muted">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v3m0 6v3m6-6h-3m-6 0H6m12.364-3.364l-2.121 2.121m.707 10.607l2.122-2.121M5.636 16.95l2.121-2.121m0-5.657l-2.121-2.12"
                />
              </svg>
            </div>
          )}

          {error && <p className="text-xs text-danger mt-1">{error}</p>}

          {open && results.length > 0 && (
            <ul className="w-full rounded-lg border border-border bg-card shadow-lg mt-2">
              {results.map((place, i) => (
                <li key={`${place.lat}-${place.lng}-${i}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(place);
                    }}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`w-full text-left px-3 py-2.5 text-sm text-foreground transition-colors ${
                      i === focusedIndex ? "bg-primary/15" : "hover:bg-primary/10"
                    }`}
                  >
                    <span className="break-words">{place.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}