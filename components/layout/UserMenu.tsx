"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { createClient } from "@/lib/supabase/client";

type UserMenuProps = {
  userLabel: string;
  userEmail?: string | null;
  avatarUrl?: string | null;
};

export function UserMenu({
  userLabel,
  userEmail = null,
  avatarUrl = null,
}: UserMenuProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const initial = userLabel.trim().charAt(0).toUpperCase() || "U";
  const isDark = theme === "dark";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex max-w-[13rem] items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 py-1 pl-1 pr-3 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50 sm:max-w-[16rem]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-black text-slate-200 light:bg-slate-100 light:text-slate-700">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : initial ? (
            initial
          ) : (
            <User size={16} aria-hidden="true" />
          )}
        </span>
        <span className="hidden min-w-0 truncate sm:inline">{userLabel}</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/40 light:border-slate-200 light:bg-white light:shadow-slate-200/80"
        >
          <div className="flex items-center gap-3 border-b border-slate-800 p-4 light:border-slate-200">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-base font-black text-slate-200 light:bg-slate-100 light:text-slate-700">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-100 light:text-slate-950">
                {userLabel}
              </p>
              {userEmail ? (
                <p className="mt-0.5 truncate text-xs text-slate-400 light:text-slate-500">
                  {userEmail}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-2">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-slate-800 light:text-slate-800 light:hover:bg-slate-100"
            >
              <User size={16} aria-hidden="true" />
              Perfil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-100 transition hover:bg-slate-800 light:text-slate-800 light:hover:bg-slate-100"
            >
              {isDark ? (
                <Sun size={16} aria-hidden="true" />
              ) : (
                <Moon size={16} aria-hidden="true" />
              )}
              {isDark ? "Tema claro" : "Tema escuro"}
            </button>
          </div>

          <div className="border-t border-slate-800 p-2 light:border-slate-200">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-300 transition hover:bg-red-500/10 hover:text-red-200 light:text-red-700 light:hover:bg-red-50 light:hover:text-red-800"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
