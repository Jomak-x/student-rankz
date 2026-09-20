"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let parsed: T | undefined;
    try {
      const item = window.localStorage.getItem(key);
      if (item) parsed = JSON.parse(item) as T;
    } catch {
      // ignore
    }
    if (parsed !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoredValue(parsed);
    }
    setHydrated(true);
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // ignore
    }
  };

  return [storedValue, setValue, hydrated] as const;
}
