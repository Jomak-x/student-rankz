"use client";

import { useLocalStorage } from "./use-local-storage";

const MAX_COMPARE = 3;

export function useCompare() {
  const [selected, setSelected, hydrated] = useLocalStorage<string[]>(
    "student-rankz-compare",
    []
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const remove = (id: string) => {
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const clear = () => setSelected([]);

  const isSelected = (id: string) => selected.includes(id);
  const canAdd = selected.length < MAX_COMPARE;

  return { selected, toggle, remove, clear, isSelected, canAdd, hydrated };
}
