"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  inviteErrorMessage,
  logUnexpectedAuthError,
} from "@/lib/auth/authErrorMessages";
import { acceptInviteForCurrentUser } from "@/lib/invites/acceptInviteForCurrentUser";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const invite = searchParams.get("invite");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError("E-mail ou senha invalidos.");
      return;
    }

    if (invite) {
      const { error: inviteError } = await acceptInviteForCurrentUser({
        inviteToken: invite,
      });

      if (inviteError) {
        setIsSubmitting(false);
        setError(inviteErrorMessage(inviteError));
        logUnexpectedAuthError(inviteError);
        return;
      }
    }

    setIsSubmitting(false);
    router.replace("/dashboard/groups");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          E-mail
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Senha
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-300 light:border-red-200 light:bg-red-50 light:text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3"
      >
        <LogIn size={18} aria-hidden="true" />
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>

      {invite ? (
        <p className="text-center text-sm text-slate-400 light:text-slate-600">
          Tem convite?{" "}
          <Link
            href={`/register?invite=${encodeURIComponent(invite)}`}
            className="font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
          >
            Criar conta
          </Link>
        </p>
      ) : null}
    </form>
  );
}
