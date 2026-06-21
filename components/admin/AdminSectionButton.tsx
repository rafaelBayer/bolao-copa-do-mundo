"use client";

import { useRouter } from "next/navigation";
import type { AdminPanelSection } from "@/components/admin/AdminPanelContent";
import { Card } from "@/components/ui/Card";

type AdminSectionButtonProps = {
  title: string;
  description: string;
  section: AdminPanelSection;
};

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/dashboard; max-age=31536000; samesite=lax`;
}

export function AdminSectionButton({
  title,
  description,
  section,
}: AdminSectionButtonProps) {
  const router = useRouter();

  function handleClick() {
    savePreference("bolao_profile_tab", "admin");
    savePreference("bolao_admin_section", section);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} className="text-left">
      <Card className="h-full p-4 transition hover:border-emerald-400/50">
        <h2 className="font-black text-slate-50 light:text-slate-950">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
          {description}
        </p>
      </Card>
    </button>
  );
}
