import { Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type KnockoutStatusProps = {
  isLocked: boolean;
  deadlineLabel: string;
  submittedAtLabel: string | null;
};

export function KnockoutStatus({
  isLocked,
  deadlineLabel,
  submittedAtLabel,
}: KnockoutStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={isLocked ? "amber" : "emerald"}>
        {isLocked ? "Bloqueado" : "Aberto"}
      </Badge>
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/55 px-3 py-1 text-xs font-bold text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
        {isLocked ? (
          <Lock size={14} aria-hidden="true" />
        ) : (
          <Clock size={14} aria-hidden="true" />
        )}
        Bloqueio: {deadlineLabel}
      </span>
      {submittedAtLabel ? (
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-700">
          Salvo em {submittedAtLabel}
        </span>
      ) : null}
    </div>
  );
}
