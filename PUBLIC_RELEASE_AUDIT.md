# Public Release Audit

Data: 2026-06-23

## Objetivo

Preparar o repositorio para publicacao publica no GitHub, removendo referencias corporativas, nomes internos, project refs reais e qualquer risco evidente de secrets no estado atual do projeto.

## Termos buscados

- Nome corporativo antigo em diferentes capitalizacoes.
- Variacoes de nome de projeto interno e nomes antigos de variaveis de Supabase.
- Project refs reais conhecidos.
- `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret`, `sb_publishable`
- `SCORES_SYNC_SECRET`, `FOOTBALL_DATA_API_KEY`, `API_FOOTBALL_KEY`
- `DATABASE_URL`, `POSTGRES_URL`, `PASSWORD`, `TOKEN`, `SECRET`, `API_KEY`, `eyJ`

## Arquivos alterados

- `.env.example`
- `.env.scores.example`
- `.gitignore`
- `README.md`
- `docs/live-scores.md`
- `docs/setup-supabase.md`
- `components/groups/GroupsDashboardClient.tsx`
- `lib/scores/resolveScoreSupabaseEnv.ts`
- `lib/supabase/scriptEnv.ts`
- `package.json`
- `PUBLIC_RELEASE_AUDIT.md`

## Referencias removidas ou substituidas

- Variaveis locais antigas de multiplos Supabases foram removidas do app.
- Scripts de placar passaram a usar `.env.scores.local`, separado de `.env.local`.
- Regras de ignore com nome especifico antigo foram trocadas por padroes genericos de backup.
- Documentacao de setup e live scores foi ajustada para nomes neutros e sem referencias internas.
- Exemplos de selecao de Supabase foram movidos para variaveis exclusivas dos scripts de placar.

## Secrets e credenciais

- Nenhum secret real deve permanecer em arquivos versionados no estado atual.
- `.env.example` contem apenas placeholders vazios ou genericos.
- `.env.local` e `.env.production.local` foram sanitizados localmente e continuam ignorados pelo Git.
- `.env.scores.local` foi criado localmente com placeholders e continua ignorado pelo Git.
- Arquivos temporarios locais com contexto antigo e logs foram removidos.
- Caso algum secret tenha sido exposto antes desta auditoria, manter as chaves rotacionadas e avaliar limpeza de historico Git antes de tornar o repositorio publico.

## Gitignore

Confirmado ou adicionado:

- `.env`
- `.env.*`
- `!.env.example`
- `!.env.scores.example`
- `backups/`
- `*.dump`
- `*.backup`
- `*.sql.backup`
- `*backup*.sql`
- `supabase/.temp/`
- `supabase/manual-production-update.sql`
- `supabase/manual-production-update-INSTRUCTIONS.md`
- `.next/`
- `node_modules/`
- `dist/`
- `build/`
- `.vercel`
- `logs/`

As migrations em `supabase/migrations/*.sql` continuam versionaveis.

## Arquivos locais removidos

- `context*.md`
- `RELATORIO_APIS.md`
- `logs/*`
- `supabase/.temp/`

Esses arquivos eram locais/ignorados e nao fazem parte do pacote publico do projeto.

## Resultado das buscas

- Busca por referencias corporativas em arquivos versionados: sem ocorrencias relevantes.
- Falso positivo conhecido: `package-lock.json` contem uma substring coincidente dentro de um hash `integrity` de dependencia. Nao e referencia corporativa.
- Busca por secrets em arquivos versionados: apenas placeholders, nomes de variaveis, codigo de formulario de senha, cabecalhos esperados e hashes de lockfile.

## Validacoes executadas

- `npm run lint`: passou.
- `npm run build`: passou.

## Pendencias antes de publicar

- Configurar secrets reais apenas no provedor de deploy ou ambiente local, nunca no repositorio.
- Confirmar que as chaves antigas permanecem rotacionadas.
- Rodar QA manual final no ambiente de publicacao.
- Se houver risco de secrets no historico Git antigo, avaliar limpeza de historico com uma etapa separada e confirmada.
