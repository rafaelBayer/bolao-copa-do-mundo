"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  authErrorMessage,
  logUnexpectedAuthError,
} from "@/lib/auth/authErrorMessages";
import { createClient } from "@/lib/supabase/client";

function userHasNoIdentities(user: unknown) {
  if (!user || typeof user !== "object" || !("identities" in user)) {
    return false;
  }

  const identities = (user as { identities?: unknown }).identities;

  return Array.isArray(identities) && identities.length === 0;
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          name,
          full_name: name,
        },
      },
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(authErrorMessage(signUpError, email));
      logUnexpectedAuthError(signUpError);
      return;
    }

    if (!data.session) {
      setMessage(
        userHasNoIdentities(data.user)
          ? "Este e-mail ja esta cadastrado. Faca login para continuar."
          : "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
      );
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Nome
        </label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
      </div>

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
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirm-password"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Confirmar senha
        </label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-300 light:border-red-200 light:bg-red-50 light:text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-200 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-800">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full py-3">
        <UserPlus size={18} aria-hidden="true" />
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-slate-400 light:text-slate-600">
        Ja tem conta?{" "}
        <Link
          href="/login"
          className="font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
