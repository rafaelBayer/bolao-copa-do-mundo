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

Na Vercel, use apenas essas variaveis padrao do Supabase publico/MVP. Nao configure `SUPABASE_TARGET` em producao.

## Scripts locais com dois Supabase

`SUPABASE_TARGET` e as variaveis `LEGACY_SUPABASE_*` / `PUBLIC_SUPABASE_*` sao apenas para scripts locais/server-side. Elas nao sao usadas pelo frontend.

Exemplos:

```bash
SUPABASE_TARGET=legacy npm run scores:map-fixtures:dry
SUPABASE_TARGET=public npm run scores:map-fixtures:dry
```

No PowerShell:

```powershell
$env:SUPABASE_TARGET="public"; npm run scores:map-fixtures:dry
```

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
