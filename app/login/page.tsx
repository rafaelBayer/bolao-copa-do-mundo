import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur light:border-slate-200 light:bg-white light:shadow-slate-200/80 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-300 light:text-emerald-700">
            Bolao da Copa
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-50 light:text-slate-950">
            Entre no seu bolao
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            Acesse seus palpites da Copa do Mundo.
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-500 light:text-slate-500">
          Cadastro somente por convite.
        </p>
        <p className="mt-2 text-center text-xs text-slate-500 light:text-slate-500">
          <Link
            href="/register"
            className="font-medium transition hover:text-emerald-300 light:hover:text-emerald-700"
          >
            Acessar tela de convite
          </Link>
        </p>
      </section>
    </main>
  );
}
