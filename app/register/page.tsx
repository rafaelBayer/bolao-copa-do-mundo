import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

type RegisterPageProps = {
  searchParams: Promise<{
    invite?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { invite } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur light:border-slate-200 light:bg-white light:shadow-slate-200/80 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-300 light:text-emerald-700">
            Bolao da Copa
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-50 light:text-slate-950">
            Entrar no bolao
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            Crie sua conta usando o convite recebido.
          </p>
        </div>

        {invite ? (
          <RegisterForm inviteToken={invite} />
        ) : (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 light:border-amber-200 light:bg-amber-50">
            <p className="text-sm font-bold text-amber-200 light:text-amber-900">
              Convite obrigatorio.
            </p>
            <p className="mt-2 text-sm text-amber-100/80 light:text-amber-800">
              Use o link enviado pelo dono do bolao para criar sua conta.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-400 light:text-slate-600">
          Ja tem conta?{" "}
          <Link
            href="/login"
            className="font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
