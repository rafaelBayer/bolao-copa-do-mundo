# Contexto do Projeto - Bolao da Copa do Mundo

## Visao geral

Este projeto e um MVP simples de bolao da Copa do Mundo para amigos.

O escopo inicial cobre somente a fase de grupos. Mata-mata, ranking, pontuacao automatica e painel administrativo completo ficam para etapas futuras.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase RLS
- Pacotes Supabase para SSR/cookies: `@supabase/ssr` e `@supabase/supabase-js`

## Regras de negocio

- Login com e-mail e senha.
- Nao existe cadastro publico livre.
- Cadastro so pode acontecer via convite.
- O dono do bolao envia um link `/register?invite=TOKEN`.
- Somente convite valido, nao usado e nao expirado permite criar conta.
- Cada usuario ve apenas boloes dos quais participa.
- Cada usuario ve e edita apenas os proprios palpites.
- Usuario comum nao ve palpites de outros usuarios.
- Nesta etapa, o usuario edita apenas placares dos palpites da fase de grupos.
- Nao existe botao de salvar para palpite.
- Palpite salva automaticamente apos o usuario parar de digitar.
- Campo de placar vazio deve ser salvo como `null`.
- Placar negativo nao e permitido.

## Fluxos principais

### Login

1. Usuario acessa `/login`.
2. Informa e-mail e senha.
3. Supabase Auth autentica.
4. Usuario e enviado para `/dashboard/groups`.

### Cadastro por convite

1. Dono cria um convite no banco.
2. Sistema gera um token unico.
3. Dono envia o link `/register?invite=TOKEN`.
4. Convidado cria conta com nome, e-mail e senha.
5. Apos criar conta, o app chama a RPC `accept_pool_invite(invite_token text)`.
6. A RPC valida e consome o convite.
7. Usuario vira membro do bolao.
8. Usuario e enviado para `/dashboard/groups`.

Observacao: para o fluxo imediato de aceitar convite apos cadastro, o projeto Supabase deve permitir sessao logo apos `signUp`. Se confirmacao de e-mail estiver ligada, sera preciso ajustar o fluxo para aceitar convite apos o primeiro login confirmado.

## Layout da fase de grupos

Inspiracao visual: simulador da GE/Globo Esporte.

- Grupos aparecem um abaixo do outro.
- Cada grupo fica em uma section/card.
- Desktop usa grid de 12 colunas.
- Tabela/classificacao ocupa 8 colunas.
- Jogos do grupo ocupam 4 colunas.
- Mobile fica em uma coluna.
- Jogos mostram apenas 2 partidas por rodada.
- Navegacao por rodada com anterior/proxima.
- Texto exibido: `Rodada 1`, `Rodada 2`, `Rodada 3`.

## Estrutura alvo

```txt
app/
  login/
    page.tsx
  register/
    page.tsx
  dashboard/
    layout.tsx
    page.tsx
    groups/
      page.tsx

components/
  auth/
    LoginForm.tsx
    RegisterForm.tsx
  groups/
    GroupSection.tsx
    GroupTable.tsx
    GroupMatches.tsx
    MatchPredictionInput.tsx
    RoundNavigator.tsx
  layout/
    DashboardHeader.tsx

lib/
  supabase/
    client.ts
    server.ts
    middleware.ts
  predictions/
    savePrediction.ts
  groups/
    calculateGroupTable.ts
  mock/
    groups.ts

types/
  group.ts
  match.ts
  prediction.ts

supabase/
  migrations/
    0001_initial_schema.sql
  seed.sql
```

## Modelagem de banco

### `pools`

Representa um bolao.

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `owner_id uuid not null references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `pool_members`

Participantes de um bolao.

- `id uuid primary key default gen_random_uuid()`
- `pool_id uuid not null references pools(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role text not null default 'member'`
- `created_at timestamptz not null default now()`
- `unique(pool_id, user_id)`

### `pool_invites`

Convites enviados pelo dono.

- `id uuid primary key default gen_random_uuid()`
- `pool_id uuid not null references pools(id) on delete cascade`
- `token text not null unique`
- `created_by uuid not null references auth.users(id)`
- `used_by uuid references auth.users(id)`
- `used_at timestamptz`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`

### `teams`

Selecoes.

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `code text`
- `flag_url text`
- `created_at timestamptz not null default now()`

### `groups`

Grupos da fase de grupos.

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `created_at timestamptz not null default now()`

### `group_teams`

Relacao entre grupo e selecao.

- `id uuid primary key default gen_random_uuid()`
- `group_id uuid not null references groups(id) on delete cascade`
- `team_id uuid not null references teams(id) on delete cascade`
- `position int`
- `created_at timestamptz not null default now()`
- `unique(group_id, team_id)`

### `matches`

Jogos da fase de grupos.

- `id uuid primary key default gen_random_uuid()`
- `group_id uuid not null references groups(id) on delete cascade`
- `home_team_id uuid not null references teams(id)`
- `away_team_id uuid not null references teams(id)`
- `round_number int not null`
- `match_date timestamptz`
- `home_score int`
- `away_score int`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`home_score` e `away_score` sao resultados reais do jogo, nao o palpite do usuario.

### `predictions`

Palpites dos usuarios.

- `id uuid primary key default gen_random_uuid()`
- `pool_id uuid not null references pools(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `match_id uuid not null references matches(id) on delete cascade`
- `home_score int`
- `away_score int`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique(pool_id, user_id, match_id)`

## RLS

- `pools`: usuario ve apenas boloes em que participa.
- `pool_members`: usuario ve membros dos boloes em que participa; dono pode gerenciar.
- `pool_invites`: apenas dono gerencia convites.
- `teams`, `groups`, `group_teams`, `matches`: usuarios autenticados podem visualizar.
- `predictions`: usuario ve, cria e atualiza apenas seus proprios palpites e somente em bolao onde e membro.

## RPC de convite

Funcao: `accept_pool_invite(invite_token text)`

Responsabilidades:

- Exigir usuario autenticado.
- Verificar se token existe.
- Verificar se convite nao foi usado.
- Verificar se convite nao expirou.
- Inserir usuario em `pool_members`.
- Marcar convite como usado.
- Retornar `pool_id`.

## Salvamento automatico dos palpites

- Inputs `type="number"`, `min={0}`, `max={99}`.
- Campo vazio vira `null`.
- Valor negativo vira `0` ou e bloqueado.
- Debounce entre 600ms e 1000ms.
- Upsert em `predictions` usando conflito `pool_id,user_id,match_id`.
- Feedback discreto: `Salvando...`, `Salvo`, `Erro ao salvar`.

## Calculo da classificacao

Tabela exibe:

- Selecao
- P
- J
- V
- E
- D
- GP
- GC
- SG

Regras:

- Vitoria: 3 pontos.
- Empate: 1 ponto.
- Derrota: 0 pontos.
- Ordenacao: pontos, saldo de gols, gols pro, nome.
- Se nao houver resultados reais, tabela comeca zerada.

## Ordem de implementacao

1. Base Next.js, TypeScript, Tailwind e Git local.
2. Supabase SSR/cookies, env example e protecao de rotas.
3. Migration com tabelas, constraints, RLS e RPC de convite.
4. Seed simples e editavel da fase de grupos.
5. Login, cadastro por convite e logout.
6. Dashboard protegido.
7. Tela `/dashboard/groups` com grupos, tabela e jogos por rodada.
8. Inputs de palpite com debounce e upsert.
9. Rodar lint/build e corrigir erros.

## Fora do escopo desta rodada

- Mata-mata.
- Ranking.
- Pontuacao do bolao.
- Admin completo.
- Recuperacao de senha.
- API externa de dados da Copa.
- Pagamentos.
- Multi-boloes avancado.

## Direção visual e tema

- App com tema escuro como padrão.
- Tema claro opcional.
- Alternância de tema pelo header.
- Preferência salva em `localStorage`.
- Se não houver preferência salva, usar tema escuro.
- Visual inspirado em bolões, Copa do Mundo, apps esportivos e dashboards.
- Não parecer plataforma de aposta com dinheiro real.
- Cards modernos com `rounded-2xl`, bordas suaves, sombras discretas, hover states e transições suaves.
- Inputs de placar maiores, centralizados e fáceis de clicar.
- Feedback de salvamento discreto no próprio card do jogo.
- Login e cadastro com visual mais caprichado, card centralizado, título forte, subtítulo curto e botões em destaque.
- Não alterar regras de negócio nesta etapa.

### Paleta base

Tema escuro:

- Background principal: `slate-950`.
- Cards: `slate-900` ou `zinc-900`.
- Cards secundários: `slate-800`.
- Bordas: `slate-700`.
- Texto principal: `slate-50`.
- Texto secundário: `slate-400`.
- Destaque positivo: `emerald-400` / `emerald-500`.
- Destaque esportivo: `yellow-400` / `amber-400`.
- Ações principais: `emerald-500`.
- Erros: `red-400`.

Tema claro:

- Background principal: `slate-50`.
- Cards: `white`.
- Bordas: `slate-200`.
- Texto principal: `slate-950`.
- Texto secundário: `slate-500`.
- Destaque positivo: `emerald-600`.
- Ações principais: `emerald-600`.
- Erros: `red-600`.

### Regras desta etapa visual

- Não criar botão de salvar palpite.
- Não remover auth, Supabase, RLS nem fluxo de convite.
- Não implementar playoffs/mata-mata agora.
- Não implementar ranking agora.
- Manter salvamento automático com debounce.

## Dados oficiais da Copa

- O app não deve usar dados aleatórios em produção.
- A fonte principal para conferir seleções, grupos e jogos deve ser a FIFA.
- O projeto deve manter um arquivo local versionado com os dados oficiais da Copa.
- O app não deve depender de API externa em runtime para carregar a tabela da fase de grupos.
- A importação dos dados oficiais deve acontecer via script local/semiautomático.
- O fluxo esperado é: fonte oficial FIFA -> arquivo local versionado -> script de importação -> Supabase -> app lê do Supabase.
- Resultados em tempo real, placar ao vivo, cron job e atualização automática diária ficam fora do escopo.
- Se a FIFA alterar algum jogo, atualizamos o arquivo local e rodamos o script novamente.
- O seed SQL mockado pode continuar existindo para desenvolvimento inicial, mas produção deve usar `data/world-cup-2026.ts` e `scripts/import-world-cup-2026.ts`.
- O script de importação não deve apagar palpites de usuários nem tocar em `predictions`.

## Administração do bolão

- Apenas usuários com role `owner` em `pool_members` podem acessar `/dashboard/admin`.
- Usuários com role `member` não acessam a administração.
- O header deve mostrar o link `Admin` apenas para owners.
- O owner pode gerar convites para o próprio bolão.
- O owner pode copiar links de convite no formato `/register?invite=TOKEN`.
- O owner pode visualizar participantes do bolão.
- A tela de administração deve respeitar Supabase Auth e RLS, sem service role no frontend.
- A administração não altera palpites, ranking, playoffs ou dados oficiais da Copa.
## Dados oficiais da Copa - importacao validada

- O app nao deve usar dados aleatorios em producao.
- A fonte principal para conferir selecoes, grupos e jogos deve ser a FIFA.
- Os dados oficiais ficam versionados em `data/world-cup-2026.ts`.
- A importacao deve ser feita manualmente via `scripts/import-world-cup-2026.ts`.
- O app nao depende da FIFA em runtime.
- Antes de importar, os dados precisam passar por `scripts/validate-world-cup-2026.ts`.
- A fase de grupos deve ter 12 grupos, 48 selecoes e 72 jogos.
- Cada grupo deve ter 4 selecoes, 6 jogos e 3 rodadas com 2 jogos por rodada.
- O fluxo esperado e: FIFA oficial -> `data/world-cup-2026.ts` -> validacao -> importacao -> Supabase -> app le do Supabase.
- O import nao pode apagar palpites de usuarios nem tocar em `predictions`.
- Para testar sem gravar no Supabase, usar `npm run seed:worldcup:dry`.
