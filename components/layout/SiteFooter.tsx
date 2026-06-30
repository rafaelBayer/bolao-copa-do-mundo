import { Coffee } from "lucide-react";

// Atualize estes links quando os perfis finais estiverem definidos.
const PORTFOLIO_URL = "https://rafael-bayer.vercel.app/";
const GITHUB_URL = "https://github.com/rafaelBayer";
const LINKEDIN_URL = "https://www.linkedin.com/in/rafaelbayer0/";
const BUY_ME_A_COFFEE_URL = "https://www.buymeacoffee.com/rafaelBayer_";

const socialLinks = [
  {
    href: GITHUB_URL,
    label: "GitHub",
    icon: <GitHubIcon />,
  },
  {
    href: LINKEDIN_URL,
    label: "LinkedIn",
    icon: <LinkedInIcon />,
  },
];

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.29 9.29 0 0 1 12 6.94c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.82 0 .27.18.59.69.49A10.15 10.15 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5ZM3 9.75h4v10.75H3V9.75Zm6.25 0h3.83v1.47h.05c.53-.95 1.84-1.95 3.79-1.95 4.05 0 4.8 2.67 4.8 6.14v5.09h-4v-4.51c0-1.08-.02-2.46-1.5-2.46-1.5 0-1.73 1.17-1.73 2.38v4.6h-4V9.75Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 px-3 py-7 light:border-slate-200 light:bg-white sm:px-5 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1536px] gap-6 text-center md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:text-left">
        <div className="space-y-2 text-sm font-medium text-slate-400 light:text-slate-500">
          <p className="font-black text-slate-200 light:text-slate-800">
            Bolão da Copa
          </p>
          <p>Feito para acompanhar a Copa com os amigos.</p>
          <p>
            Desenvolvido por{" "}
            {PORTFOLIO_URL ? (
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-black text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
              >
                Rafael Bayer
              </a>
            ) : (
              <span className="font-black text-slate-200 light:text-slate-800">
                Rafael Bayer
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 md:items-end">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 light:text-slate-400">
            Gostou do projeto? Apoie meu trabalho
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:-translate-y-0.5 hover:border-emerald-400/60 hover:bg-slate-800 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/15 light:border-slate-200 light:bg-slate-50 light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-white light:hover:text-emerald-700"
                aria-label={`Abrir ${link.label} em nova aba`}
                title={link.label}
              >
                {link.icon}
              </a>
            ))}

            <a
              href={BUY_ME_A_COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#FFDD00] px-4 py-2 text-sm font-black text-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/40"
              aria-label="Abrir Buy Me a Coffee em nova aba"
            >
              <Coffee size={16} aria-hidden="true" />
              <span>Buy me a coffee</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
