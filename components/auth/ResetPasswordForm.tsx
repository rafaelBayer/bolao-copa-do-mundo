"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [missingCode, setMissingCode] = useState(false);
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareSession() {
      const supabase = createClient();
      const code = searchParams.get("code");

      if (!code) {
        if (isMounted) {
          setMissingCode(true);
          setError("Solicite um novo link de recuperação para redefinir sua senha.");
          setIsPreparingSession(false);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError && isMounted) {
          setError(
            "O link de recuperação expirou ou já foi usado. Solicite um novo link.",
          );
        }
      }

      if (isMounted) {
        setIsPreparingSession(false);
      }
    }

    void prepareSession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setIsSubmitting(false);

    if (updateError) {
      setError(
        "Não foi possível redefinir a senha. Solicite um novo link e tente novamente.",
      );
      return;
    }

    setMessage("Senha atualizada com sucesso.");
    window.setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 900);
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Nova senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={isPreparingSession || missingCode}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirm-password"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Confirmar nova senha
        </label>
        <Input
          id="confirm-password"
          name="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={isPreparingSession || missingCode}
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

      <Button
        type="submit"
        disabled={isPreparingSession || isSubmitting || missingCode}
        className="w-full py-3"
      >
        <KeyRound size={18} aria-hidden="true" />
        {isSubmitting ? "Atualizando..." : "Redefinir senha"}
      </Button>

      {missingCode ? (
        <Link
          href="/esqueci-senha"
          className="block text-center text-sm font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
        >
          Solicitar novo link
        </Link>
      ) : null}
    </form>
  );
}
