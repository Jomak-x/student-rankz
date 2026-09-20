"use client";

import { useCompare } from "@/hooks/use-compare";
import { Button } from "./ui/button";
import { PlusCircle, CheckCircle, GitCompareArrows } from "lucide-react";
import Link from "next/link";

interface CompareToggleProps {
  universityId: string;
}

export function CompareToggle({ universityId }: CompareToggleProps) {
  const { toggle, isSelected, canAdd, selected } = useCompare();
  const selected_ = isSelected(universityId);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={selected_ ? "secondary" : "outline"}
        size="sm"
        onClick={() => toggle(universityId)}
        disabled={!selected_ && !canAdd}
        aria-label={selected_ ? "Remove from comparison" : "Add to comparison"}
      >
        {selected_ ? (
          <>
            <CheckCircle className="size-3.5 mr-1.5 text-primary" /> In compare
          </>
        ) : (
          <>
            <PlusCircle className="size-3.5 mr-1.5" />
            {canAdd ? "Compare" : "Max 3"}
          </>
        )}
      </Button>
      {selected.length > 0 && (
        <Link href="/compare">
          <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
            <GitCompareArrows className="size-3.5" />
            View ({selected.length})
          </Button>
        </Link>
      )}
    </div>
  );
}
