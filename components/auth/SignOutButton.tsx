"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();

    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" onClick={handleSignOut}>
      <LogOut size={17} aria-hidden="true" />
      Sair
    </Button>
  );
}
