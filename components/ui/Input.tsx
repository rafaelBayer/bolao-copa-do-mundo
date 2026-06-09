import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 light:border-slate-200 light:bg-white light:text-slate-950 light:placeholder:text-slate-400 light:focus:border-emerald-600 light:focus:ring-emerald-600/10 ${className}`}
      {...props}
    />
  );
}
