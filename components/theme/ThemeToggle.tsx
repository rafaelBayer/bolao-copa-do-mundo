"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Usar tema claro" : "Usar tema escuro"}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-amber-300/70 hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
    >
      {isDark ? (
        <Sun size={17} aria-hidden="true" />
      ) : (
        <Moon size={17} aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
