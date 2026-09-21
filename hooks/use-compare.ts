"use client";

import { useMemo } from "react";
import { useLocalStorage } from "./use-local-storage";


const MAX_COMPARE = 3;
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;

function normalizeCompare(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter((id): id is string => typeof id === "string" && validSlug(id))
    ),
  ].slice(0, MAX_COMPARE);
}

export function useCompare() {
  const [rawSelected, setSelected, hydrated] = useLocalStorage<string[]>(
    "student-rankz-catalog-compare",
    []
  );

  // Normalize on every render: unknown IDs, duplicates, and over-limit are
  // silently dropped so malformed storage never reaches .map / .includes.
  const selected = useMemo(() => normalizeCompare(rawSelected), [rawSelected]);

  const toggle = (id: string) => {
    if (!validSlug(id)) return;
    setSelected((prev) => {
      const clean = normalizeCompare(prev);
      if (clean.includes(id)) return clean.filter((x) => x !== id);
      if (clean.length >= MAX_COMPARE) return clean;
      return [...clean, id];
    });
  };

  const remove = (id: string) => {
    setSelected((prev) => normalizeCompare(prev).filter((x) => x !== id));
  };

  const clear = () => setSelected([]);

  const isSelected = (id: string) => selected.includes(id);
  const canAdd = selected.length < MAX_COMPARE;

  return { selected, toggle, remove, clear, isSelected, canAdd, hydrated };
}
