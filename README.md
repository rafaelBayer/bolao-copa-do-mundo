# Bolao Copa do Mundo

MVP publico de bolao para criar conta, participar do Bolao Geral, criar boloes privados, convidar amigos, registrar palpites e acompanhar rankings por bolao.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Variaveis de ambiente

Para o app local e para a Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Na Vercel, use apenas essas variaveis padrao do Supabase do app.

## Scripts locais de placar

Os scripts de placar usam um arquivo separado, ignorado pelo Git:

```txt
.env.scores.local
```

Use `.env.scores.example` como modelo. Esse arquivo nao usa variaveis `NEXT_PUBLIC_*` e existe apenas para execucoes locais/server-side.

Exemplos:

```bash
SCORE_SUPABASE_TARGET=staging npm run scores:map-fixtures:dry
SCORE_SUPABASE_TARGET=production,staging npm run scores:watch:local:dry
```

No PowerShell:

```powershell
$env:SCORE_SUPABASE_TARGET="production,staging"; npm run scores:map-fixtures:dry
Remove-Item Env:\SCORE_SUPABASE_TARGET
```

O app Next.js nao alterna entre multiplos Supabases em runtime. A selecao de target existe apenas para scripts de placar locais. Use lista separada por virgula quando quiser aplicar a mesma execucao em mais de um banco.

## Placar ao vivo

As rotas de sync automatico estao desativadas neste MVP publico. Use o painel manual de partidas para ajustar placares quando necessario. Nao rode scripts reais de score sem conferir o target e preferir `--dry-run` primeiro.

## Banco

Aplique as migrations no Supabase publico antes do deploy. A permissao de admin global fica separada de owner de bolao privado via `system_admins`.

## Validacao

```bash
npm run lint
npm run build
```

Nao ha suite automatizada de testes configurada ainda.

## Docs

Veja tambem `docs/setup-supabase.md`, se precisar de detalhes de configuracao do Supabase.
