"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let parsed: T | undefined;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const candidate = JSON.parse(item) as T;
        // Guard: if caller expects an array, only accept an array
        if (Array.isArray(initialValue) && !Array.isArray(candidate)) {
          // fall through — keep initialValue
        } else {
          parsed = candidate;
        }
      }
    } catch {
      // ignore parse errors
    }
    if (parsed !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoredValue(parsed);
    }
    setHydrated(true);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Returns true if the write succeeded, false on storage error.
  const setValue = (value: T | ((val: T) => T)): boolean => {
    try {
      // Read the freshest value from storage so concurrent same-page instances
      // (e.g. two ReviewComposers) don't overwrite each other's writes.
      let current = storedValue;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) current = JSON.parse(raw) as T;
      } catch {
        // fall back to React state
      }

      const valueToStore = value instanceof Function ? value(current) : value;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      setStoredValue(valueToStore);
      return true;
    } catch {
      return false;
    }
  };

  return [storedValue, setValue, hydrated] as const;
}
