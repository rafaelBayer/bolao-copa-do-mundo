import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Bolao da Copa
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Entrar</h1>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-500">
          Cadastro somente por convite.
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          <Link href="/register" className="hover:text-emerald-700">
            Acessar tela de convite
          </Link>
        </p>
      </section>
    </main>
  );
}
