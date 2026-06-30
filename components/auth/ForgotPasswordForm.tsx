"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Informe seu e-mail.");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmedEmail,
      { redirectTo },
    );

    setIsSubmitting(false);

    if (resetError) {
      setError("Não foi possível enviar o link. Verifique o e-mail informado.");
      return;
    }

    setMessage("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
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
        <Mail size={18} aria-hidden="true" />
        {isSubmitting ? "Enviando..." : "Enviar link"}
      </Button>

      <p className="text-center text-sm text-slate-400 light:text-slate-600">
        Lembrou a senha?{" "}
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
