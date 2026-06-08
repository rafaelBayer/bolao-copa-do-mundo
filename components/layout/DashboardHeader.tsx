"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DashboardHeaderProps = {
  userLabel: string;
};

export function DashboardHeader({ userLabel }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard/groups" className="text-lg font-bold text-slate-950">
            Bolao da Copa
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/dashboard/groups"
              className="text-slate-600 transition hover:text-emerald-700"
            >
              Grupos
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="max-w-44 truncate text-sm text-slate-600">
            {userLabel}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sair"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
