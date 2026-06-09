import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses = {
  primary:
    "bg-emerald-500 text-slate-950 shadow-emerald-950/20 hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700",
  secondary:
    "border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50",
  ghost:
    "text-slate-300 hover:bg-slate-800 hover:text-slate-50 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-950",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
