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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Bolao da Copa
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Criar conta</h1>
        </div>

        {invite ? (
          <RegisterForm inviteToken={invite} />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              Convite obrigatorio.
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Use o link enviado pelo dono do bolao para criar sua conta.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Ja tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-700 hover:text-emerald-800"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
