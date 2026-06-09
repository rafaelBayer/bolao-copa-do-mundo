"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getOrCreateBrowserFingerprint } from "@/lib/invites/browserFingerprint";
import { createClient } from "@/lib/supabase/client";

type RegisterFormProps = {
  inviteToken: string;
};

export function RegisterForm({ inviteToken }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setIsSubmitting(false);
      setError(
        "Conta criada, mas o Supabase exige confirmacao de e-mail antes de entrar no bolao.",
      );
      return;
    }

    const browserFingerprint = getOrCreateBrowserFingerprint();
    const { error: inviteError } = await supabase.rpc("accept_pool_invite", {
      invite_token: inviteToken,
      browser_fingerprint: browserFingerprint,
      user_agent: navigator.userAgent,
    });

    setIsSubmitting(false);

    if (inviteError) {
      const message = inviteError.message.toLowerCase();
      setError(
        message.includes("browser")
          ? "Este navegador ja usou este convite."
          : "Convite invalido ou expirado.",
      );
      return;
    }

    router.replace("/dashboard/groups");
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
