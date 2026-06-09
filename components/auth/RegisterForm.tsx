"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  authErrorMessage,
  inviteErrorMessage,
  logUnexpectedAuthError,
} from "@/lib/auth/authErrorMessages";
import { getOrCreateBrowserFingerprint } from "@/lib/invites/browserFingerprint";
import { createClient } from "@/lib/supabase/client";

type RegisterFormProps = {
  inviteToken: string;
};

function userHasNoIdentities(user: unknown) {
  if (!user || typeof user !== "object" || !("identities" in user)) {
    return false;
  }

  const identities = (user as { identities?: unknown }).identities;

  return Array.isArray(identities) && identities.length === 0;
}

export function RegisterForm({ inviteToken }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountCreatedNeedsInvite, setAccountCreatedNeedsInvite] =
    useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
      setIsCheckingSession(false);
    });
  }, []);

  async function acceptInvite(accountWasJustCreated = false) {
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const browserFingerprint = getOrCreateBrowserFingerprint();
    const { error: inviteError } = await supabase.rpc("accept_pool_invite", {
      invite_token: inviteToken,
      browser_fingerprint: browserFingerprint,
      user_agent: navigator.userAgent,
    });

    setIsSubmitting(false);

    if (inviteError) {
      setAccountCreatedNeedsInvite(accountWasJustCreated);
      setError(inviteErrorMessage(inviteError));
      logUnexpectedAuthError(inviteError);
      return;
    }

    router.replace("/dashboard/groups");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
        data: {
          name,
        },
      },
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(authErrorMessage(signUpError, email));
      logUnexpectedAuthError(signUpError);
      return;
    }

    if (!data.session) {
      setIsSubmitting(false);
      setError(
        userHasNoIdentities(data.user)
          ? "Este e-mail ja esta cadastrado. Faca login e abra o convite novamente."
          : "Nao foi possivel entrar automaticamente. Se este e-mail ja existe, faca login e abra o convite novamente. Se a conta foi criada agora, confirme o e-mail antes de tentar entrar no bolao.",
      );
      return;
    }

    setIsLoggedIn(true);
    await acceptInvite(true);
  }

  if (isCheckingSession) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm font-bold text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
        Verificando convite...
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 light:border-emerald-200 light:bg-emerald-50">
          <p className="text-sm font-bold text-emerald-200 light:text-emerald-900">
            Voce ja esta logado.
          </p>
          <p className="mt-2 text-sm text-emerald-100/80 light:text-emerald-800">
            Entre neste bolao usando o convite recebido.
          </p>
        </div>
        {error ? (
          <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-300 light:border-red-200 light:bg-red-50 light:text-red-700">
            {accountCreatedNeedsInvite
              ? "Sua conta foi criada, mas nao conseguimos vincular ao bolao. Faca login e tente abrir o convite novamente."
              : error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={isSubmitting}
          className="w-full py-3"
          onClick={() => acceptInvite()}
        >
          <UserPlus size={18} aria-hidden="true" />
          {isSubmitting ? "Entrando..." : "Entrar neste bolao"}
        </Button>
      </div>
    );
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
        <div className="space-y-3">
          <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-300 light:border-red-200 light:bg-red-50 light:text-red-700">
            {accountCreatedNeedsInvite
              ? "Sua conta foi criada, mas nao conseguimos vincular ao bolao. Faca login e tente abrir o convite novamente."
              : error}
          </p>
          {accountCreatedNeedsInvite ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              className="w-full"
              onClick={() => acceptInvite(accountCreatedNeedsInvite)}
            >
              Tentar entrar no bolao novamente
            </Button>
          ) : null}
          {error.includes("ja esta cadastrado") ? (
            <Link
              href="/login"
              className="block text-center text-sm font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
            >
              Ir para login
            </Link>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3"
      >
        <UserPlus size={18} aria-hidden="true" />
        {isSubmitting ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
