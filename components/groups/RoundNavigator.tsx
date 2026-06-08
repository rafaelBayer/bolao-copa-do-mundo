"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type RoundNavigatorProps = {
  currentRound: number;
  minRound: number;
  maxRound: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function RoundNavigator({
  currentRound,
  minRound,
  maxRound,
  onPrevious,
  onNext,
}: RoundNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentRound <= minRound}
        title="Rodada anterior"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <span className="text-sm font-semibold text-slate-800">
        Rodada {currentRound}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={currentRound >= maxRound}
        title="Proxima rodada"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
