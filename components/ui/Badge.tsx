type BadgeProps = {
  children: React.ReactNode;
  tone?: "default" | "emerald" | "amber";
  className?: string;
};

const toneClasses = {
  default:
    "border-slate-700 bg-slate-800/80 text-slate-300 light:border-slate-200 light:bg-slate-100 light:text-slate-600",
  emerald:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-700",
  amber:
    "border-amber-400/25 bg-amber-400/10 text-amber-300 light:border-amber-200 light:bg-amber-50 light:text-amber-700",
};

export function Badge({
  children,
  tone = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
