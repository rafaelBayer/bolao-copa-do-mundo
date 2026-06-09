# Contexto do Projeto - BolÃ£o da Copa do Mundo

## VisÃ£o geral

Este projeto Ã© um MVP simples de bolÃ£o da Copa do Mundo para amigos.

O objetivo inicial Ã© permitir que usuÃ¡rios convidados entrem em um bolÃ£o privado, visualizem a fase de grupos da Copa, faÃ§am seus palpites dos jogos e tenham esses palpites salvos automaticamente.

Nesta primeira fase, o projeto cobre apenas:

* autenticaÃ§Ã£o;
* cadastro por convite;
* bolÃ£o privado;
* administraÃ§Ã£o simples de convites;
* fase de grupos;
* palpites por jogo;
* salvamento automÃ¡tico;
* importaÃ§Ã£o dos jogos, seleÃ§Ãµes e grupos para o Supabase.

Ficam para etapas futuras:

* mata-mata;
* ranking;
* pontuaÃ§Ã£o automÃ¡tica;
* placar ao vivo;
* resultados em tempo real;
* mÃºltiplos bolÃµes avanÃ§ados;
* painel administrativo completo.

---

## Stack

* Next.js com App Router
* TypeScript
* Tailwind CSS
* Supabase Auth
* Supabase Database
* Supabase RLS
* Supabase SSR/cookies
* `@supabase/ssr`
* `@supabase/supabase-js`
* Scripts locais com `tsx`

---

## PrincÃ­pios do projeto

O projeto deve ser simples, rÃ¡pido e fÃ¡cil de manter.

Prioridades:

* MVP funcional antes de recursos avanÃ§ados.
* Poucas telas.
* Fluxo claro.
* SeguranÃ§a com Supabase RLS.
* Visual bonito, moderno e responsivo.
* Evitar complexidade antes da hora.
* NÃ£o depender de API externa em runtime para renderizar a fase de grupos.
* Supabase deve ser a fonte final lida pelo app.

---

## Regras de negÃ³cio

* Login com e-mail e senha.
* NÃ£o existe cadastro pÃºblico livre.
* Cadastro sÃ³ pode acontecer via convite.
* O dono do bolÃ£o envia um link `/register?invite=TOKEN`.
* Somente convite vÃ¡lido, nÃ£o usado e nÃ£o expirado permite criar conta.
* Cada usuÃ¡rio vÃª apenas bolÃµes dos quais participa.
* Cada usuÃ¡rio vÃª e edita apenas os prÃ³prios palpites.
* UsuÃ¡rio comum nÃ£o vÃª palpites de outros usuÃ¡rios.
* Nesta etapa, o usuÃ¡rio edita apenas placares dos palpites da fase de grupos.
* NÃ£o existe botÃ£o de salvar para palpite.
* Palpite salva automaticamente apÃ³s o usuÃ¡rio parar de digitar.
* Campo de placar vazio deve ser salvo como `null`.
* Placar negativo nÃ£o Ã© permitido.
* O app nÃ£o deve criar prediction vazia `null/null` se o usuÃ¡rio nunca mexeu no jogo.
* Trocar rodada nÃ£o deve disparar salvamento.
* Montar/remontar componente nÃ£o deve disparar salvamento.
* SÃ³ deve salvar se o usuÃ¡rio alterar manualmente algum input.
* Se o valor atual for igual ao Ãºltimo valor salvo/original, nÃ£o deve salvar de novo.

---

## Fluxos principais

### Login

1. UsuÃ¡rio acessa `/login`.
2. Informa e-mail e senha.
3. Supabase Auth autentica.
4. UsuÃ¡rio Ã© enviado para `/dashboard/groups`.

### Cadastro por convite

1. Dono cria um convite.
2. Sistema gera um token Ãºnico.
3. Dono envia o link `/register?invite=TOKEN`.
4. Convidado acessa o link.
5. Convidado cria conta com nome, e-mail e senha.
6. ApÃ³s criar conta, o app chama a RPC `accept_pool_invite(invite_token text)`.
7. A RPC valida e consome o convite.
8. UsuÃ¡rio vira membro do bolÃ£o.
9. UsuÃ¡rio Ã© enviado para `/dashboard/groups`.

ObservaÃ§Ã£o: para o fluxo imediato de aceitar convite apÃ³s cadastro, o projeto Supabase deve permitir sessÃ£o logo apÃ³s `signUp`. Se confirmaÃ§Ã£o de e-mail estiver ligada, serÃ¡ preciso ajustar o fluxo para aceitar convite apÃ³s o primeiro login confirmado.

### AdministraÃ§Ã£o de convites

1. UsuÃ¡rio owner acessa `/dashboard/admin`.
2. Owner visualiza dados do bolÃ£o.
3. Owner visualiza participantes.
4. Owner gera convites.
5. Owner copia links de convite.
6. UsuÃ¡rios comuns nÃ£o acessam a tela de admin.

---

## Rotas principais

```txt
/login
/register?invite=TOKEN
/dashboard
/dashboard/groups
/dashboard/admin
```

---

## Layout da fase de grupos

InspiraÃ§Ã£o visual: simulador da GE/Globo Esporte.

A tela `/dashboard/groups` deve ser a principal tela do usuÃ¡rio.

Regras de layout:

* Grupos aparecem um abaixo do outro.
* Cada grupo fica em uma section/card.
* Desktop usa grid de 12 colunas.
* Tabela/classificaÃ§Ã£o ocupa 8 colunas.
* Jogos do grupo ocupam 4 colunas.
* Mobile fica em uma coluna.
* Jogos mostram apenas 2 partidas por rodada.
* NavegaÃ§Ã£o por rodada com anterior/prÃ³xima.
* Texto exibido: `Rodada 1`, `Rodada 2`, `Rodada 3`.

Exemplo conceitual:

```txt
+--------------------------------------------------------------+
| Grupo A                                      | Jogos         |
|                                              | Rodada 1      |
| Tabela com seleÃ§Ãµes                          | Jogo 1        |
| Pontos, vitÃ³rias, saldo, gols                | Jogo 2        |
|                                              | <       >     |
+--------------------------------------------------------------+
```

---

## DireÃ§Ã£o visual e tema

O projeto deve ter aparÃªncia moderna inspirada em:

* bolÃµes;
* Copa do Mundo;
* apps esportivos;
* dashboards esportivos;
* interfaces de apostas, mas sem parecer uma casa de apostas com dinheiro real.

A identidade visual deve transmitir:

* competiÃ§Ã£o entre amigos;
* futebol;
* Copa do Mundo;
* palpites;
* clareza;
* visual moderno.

### Tema

* Tema escuro Ã© o padrÃ£o.
* Tema claro Ã© opcional.
* O usuÃ¡rio pode alternar entre escuro/claro pelo header.
* PreferÃªncia deve ser salva em `localStorage`.
* Se nÃ£o houver preferÃªncia salva, usar tema escuro.
* Evitar hydration error no Next.js.

### Paleta base

Tema escuro:

* Background principal: `slate-950`.
* Cards: `slate-900` ou `zinc-900`.
* Cards secundÃ¡rios: `slate-800`.
* Bordas: `slate-700`.
* Texto principal: `slate-50`.
* Texto secundÃ¡rio: `slate-400`.
* Destaque positivo: `emerald-400` / `emerald-500`.
* Destaque esportivo: `yellow-400` / `amber-400`.
* AÃ§Ãµes principais: `emerald-500`.
* Erros: `red-400`.

Tema claro:

* Background principal: `slate-50`.
* Cards: `white`.
* Bordas: `slate-200`.
* Texto principal: `slate-950`.
* Texto secundÃ¡rio: `slate-500`.
* Destaque positivo: `emerald-600`.
* AÃ§Ãµes principais: `emerald-600`.
* Erros: `red-600`.

### Regras visuais

* Usar cards modernos.
* Usar `rounded-2xl`.
* Usar bordas suaves.
* Usar sombras discretas.
* Usar hover states.
* Usar transiÃ§Ãµes suaves.
* Inputs de placar devem ser grandes, centralizados e fÃ¡ceis de clicar.
* Feedback de salvamento deve ser discreto no prÃ³prio card do jogo.
* NÃ£o usar alert ou modal para salvamento.
* Login e cadastro devem ter visual caprichado, card centralizado, tÃ­tulo forte, subtÃ­tulo curto e botÃµes em destaque.

---

## Estrutura de pastas esperada

```txt
app/
  api/
    scores/
      sync/
        route.ts
  login/
    page.tsx
  register/
    page.tsx
  dashboard/
    layout.tsx
    page.tsx
    groups/
      page.tsx
    admin/
      page.tsx

components/
  admin/
    AdminStats.tsx
    CreateInviteButton.tsx
    InviteList.tsx
    ParticipantsList.tsx
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
  theme/
    ThemeProvider.tsx
    ThemeToggle.tsx
  ui/
    Badge.tsx
    Button.tsx
    Card.tsx
    Input.tsx

data/
  raw/
    openfootball-worldcup-2026.json
  world-cup-2026.ts

lib/
  api-football/
    client.ts
  groups/
    calculateGroupTable.ts
  predictions/
    savePrediction.ts
  scores/
    syncWorldCupScores.ts
  supabase/
    client.ts
    server.ts
    middleware.ts
  world-cup/
    openFootballAdapter.ts
    teamCodeMap.ts
    teamNamePtBrMap.ts
    validateWorldCupData.ts

scripts/
  fetch-world-cup-2026.ts
  import-world-cup-2026.ts
  validate-world-cup-2026.ts
  link-api-football-fixtures.ts

types/
  database.ts
  group.ts
  match.ts
  prediction.ts
  worldCupData.ts

supabase/
  migrations/
    0001_initial_schema.sql
    0002_world_cup_official_data.sql
    0003_match_live_scores.sql
  seed.sql
```

Nem todos os arquivos precisam existir desde a primeira entrega, mas essa Ã© a direÃ§Ã£o planejada do projeto.

---

## Modelagem de banco

### `pools`

Representa um bolÃ£o.

Campos:

```txt
id uuid primary key default gen_random_uuid()
name text not null
owner_id uuid not null references auth.users(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

---

### `pool_members`

Participantes de um bolÃ£o.

Campos:

```txt
id uuid primary key default gen_random_uuid()
pool_id uuid not null references pools(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
role text not null default 'member'
created_at timestamptz not null default now()
unique(pool_id, user_id)
```

Roles:

```txt
owner
member
```

---

### `pool_invites`

Convites enviados pelo dono.

Campos:

```txt
id uuid primary key default gen_random_uuid()
pool_id uuid not null references pools(id) on delete cascade
token text not null unique
created_by uuid not null references auth.users(id)
used_by uuid references auth.users(id)
used_at timestamptz
expires_at timestamptz
created_at timestamptz not null default now()
```

Regras:

* Um convite pode ser usado apenas uma vez.
* Convite usado tem `used_at`.
* Convite expirado tem `expires_at` menor que agora.
* Apenas owner pode criar/visualizar convites do prÃ³prio bolÃ£o.

---

### `teams`

SeleÃ§Ãµes.

Campos:

```txt
id uuid primary key default gen_random_uuid()
name text not null
code text
flag_url text
created_at timestamptz not null default now()
```

Regras:

* `code` deve ser Ãºnico quando existir.
* O import da Copa deve usar `code` como chave principal de upsert.

---

### `groups`

Grupos da fase de grupos.

Campos:

```txt
id uuid primary key default gen_random_uuid()
name text not null
created_at timestamptz not null default now()
```

Regras:

* `name` deve ser Ãºnico.
* Exemplo: `Grupo A`, `Grupo B`.

---

### `group_teams`

RelaÃ§Ã£o entre grupo e seleÃ§Ã£o.

Campos:

```txt
id uuid primary key default gen_random_uuid()
group_id uuid not null references groups(id) on delete cascade
team_id uuid not null references teams(id) on delete cascade
position int
created_at timestamptz not null default now()
unique(group_id, team_id)
```

---

### `matches`

Jogos da fase de grupos.

Campos principais:

```txt
id uuid primary key default gen_random_uuid()
group_id uuid not null references groups(id) on delete cascade
home_team_id uuid not null references teams(id)
away_team_id uuid not null references teams(id)
round_number int not null
match_date timestamptz
home_score int
away_score int
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Campos oficiais/importaÃ§Ã£o:

```txt
fifa_match_number int
stadium text
city text
country text
kickoff_at timestamptz
```

Campos futuros para placar/live score:

```txt
api_football_fixture_id bigint
status_short text
status_long text
elapsed int
home_score_live int
away_score_live int
score_updated_at timestamptz
```

ObservaÃ§Ãµes:

* `home_score` e `away_score` representam resultado real/final do jogo, nÃ£o palpite do usuÃ¡rio.
* `home_score_live` e `away_score_live` representam placar atualizado por API externa no futuro.
* O palpite do usuÃ¡rio fica em `predictions`.

---

### `predictions`

Palpites dos usuÃ¡rios.

Campos:

```txt
id uuid primary key default gen_random_uuid()
pool_id uuid not null references pools(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
match_id uuid not null references matches(id) on delete cascade
home_score int
away_score int
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(pool_id, user_id, match_id)
```

Regras:

* Cada usuÃ¡rio sÃ³ pode ter um palpite por jogo dentro de um bolÃ£o.
* UsuÃ¡rio sÃ³ vÃª, cria e edita os prÃ³prios palpites.
* UsuÃ¡rio sÃ³ pode criar/editar palpite em bolÃ£o onde participa.

---

## RLS

### `pools`

* UsuÃ¡rio vÃª apenas bolÃµes em que participa.
* Owner vÃª o prÃ³prio bolÃ£o.

### `pool_members`

* UsuÃ¡rio vÃª membros dos bolÃµes em que participa.
* Owner pode gerenciar membros do prÃ³prio bolÃ£o quando necessÃ¡rio.

### `pool_invites`

* Apenas owner gerencia convites do prÃ³prio bolÃ£o.
* Member comum nÃ£o vÃª convites.

### `teams`, `groups`, `group_teams`, `matches`

* UsuÃ¡rios autenticados podem visualizar.
* UsuÃ¡rios comuns nÃ£o podem editar.
* ImportaÃ§Ãµes/manutenÃ§Ãµes devem ser feitas por scripts server-side/local usando service role quando necessÃ¡rio.

### `predictions`

* UsuÃ¡rio vÃª apenas seus prÃ³prios palpites.
* UsuÃ¡rio cria apenas seus prÃ³prios palpites.
* UsuÃ¡rio atualiza apenas seus prÃ³prios palpites.
* UsuÃ¡rio sÃ³ pode criar/atualizar palpites em bolÃµes onde Ã© membro.

---

## RPC de convite

FunÃ§Ã£o:

```txt
accept_pool_invite(invite_token text)
```

Responsabilidades:

* Exigir usuÃ¡rio autenticado.
* Verificar se token existe.
* Verificar se convite nÃ£o foi usado.
* Verificar se convite nÃ£o expirou.
* Inserir usuÃ¡rio em `pool_members`.
* Marcar convite como usado.
* Retornar `pool_id`.

---

## AdministraÃ§Ã£o do bolÃ£o

Tela:

```txt
/dashboard/admin
```

Regras:

* Apenas usuÃ¡rios com role `owner` em `pool_members` podem acessar.
* UsuÃ¡rios com role `member` nÃ£o acessam.
* O header deve mostrar o link `Admin` apenas para owners.
* Owner pode gerar convites para o prÃ³prio bolÃ£o.
* Owner pode copiar links de convite no formato `/register?invite=TOKEN`.
* Owner pode visualizar participantes do bolÃ£o.
* A tela de administraÃ§Ã£o deve respeitar Supabase Auth e RLS.
* NÃ£o usar service role no frontend.
* A administraÃ§Ã£o nÃ£o altera palpites, ranking, playoffs ou dados oficiais da Copa.

Funcionalidades esperadas:

* Mostrar nome do bolÃ£o.
* Mostrar participantes.
* Mostrar convites.
* Mostrar status do convite:

  * disponÃ­vel;
  * usado;
  * expirado.
* Gerar novo convite.
* Copiar link do convite.

---

## Salvamento automÃ¡tico dos palpites

Os palpites devem ser salvos sem botÃ£o de salvar.

### Inputs

* `type="number"`
* `min={0}`
* `max={99}`
* Campo vazio vira `null`.
* Valor negativo deve ser bloqueado ou normalizado.
* Remover visual padrÃ£o feio do input number, se possÃ­vel.

### Debounce

* Debounce entre 600ms e 1000ms.
* Upsert em `predictions`.
* Conflito: `pool_id,user_id,match_id`.

### Feedback

Mostrar feedback discreto no card do jogo:

```txt
Salvando...
Salvo
Erro ao salvar
```

### Regras importantes de salvamento

* NÃ£o salvar ao trocar de rodada.
* NÃ£o salvar ao montar componente.
* NÃ£o salvar ao remontar componente.
* NÃ£o salvar se o usuÃ¡rio nÃ£o mexeu manualmente no input.
* NÃ£o criar prediction `null/null` para jogo vazio sem palpite anterior.
* Se jÃ¡ existir palpite salvo, salvar apenas quando o novo valor for diferente.
* Se o usuÃ¡rio voltar ao valor original, nÃ£o precisa salvar novamente.
* ApÃ³s salvar com sucesso, atualizar referÃªncia local de Ãºltimo valor salvo.

---

## CÃ¡lculo da classificaÃ§Ã£o do grupo

Tabela exibe:

```txt
SeleÃ§Ã£o
P
J
V
E
D
GP
GC
SG
```

Regras:

* VitÃ³ria: 3 pontos.
* Empate: 1 ponto.
* Derrota: 0 pontos.
* OrdenaÃ§Ã£o:

  1. pontos;
  2. saldo de gols;
  3. gols prÃ³;
  4. nome.

Se nÃ£o houver resultados reais, tabela comeÃ§a zerada.

Nesta primeira fase, a tabela pode ser calculada com base nos resultados reais cadastrados em `matches.home_score` e `matches.away_score`, se existirem.

---

## Dados oficiais da Copa via OpenFootball

O projeto nÃ£o usarÃ¡ mais importaÃ§Ã£o manual por arquivos raw de grupos e jogos.

A fonte principal para popular o banco com seleÃ§Ãµes, grupos e jogos da Copa serÃ¡ a OpenFootball, usando o repositÃ³rio `openfootball/worldcup.json`.

A OpenFootball serÃ¡ usada apenas como fonte de dados estÃ¡ticos:

* seleÃ§Ãµes;
* grupos;
* jogos;
* datas;
* horÃ¡rios;
* locais, quando disponÃ­veis.

A OpenFootball nÃ£o serÃ¡ usada para:

* placar ao vivo;
* ranking;
* atualizaÃ§Ã£o em tempo real;
* execuÃ§Ã£o no frontend;
* busca em runtime do app.

---

## Fluxo oficial de importaÃ§Ã£o da Copa

Fluxo desejado:

```txt
OpenFootball JSON
â†“
npm run fetch:worldcup
â†“
data/raw/openfootball-worldcup-2026.json
â†“
normalizaÃ§Ã£o para formato interno
â†“
data/world-cup-2026.ts
â†“
npm run validate:worldcup
â†“
npm run seed:worldcup:dry
â†“
npm run seed:worldcup
â†“
Supabase
â†“
App lÃª do Supabase
```

### Responsabilidade de cada etapa

#### `npm run fetch:worldcup`

Deve:

* buscar o JSON pÃºblico da OpenFootball;
* salvar uma cÃ³pia bruta em `data/raw/openfootball-worldcup-2026.json`;
* converter os dados para o formato interno `WorldCupSeedData`;
* gerar `data/world-cup-2026.ts`;
* rodar validaÃ§Ã£o antes de salvar o arquivo final;
* nÃ£o sobrescrever `data/world-cup-2026.ts` se a validaÃ§Ã£o falhar.

#### `npm run validate:worldcup`

Deve:

* validar se o arquivo final tem estrutura correta;
* garantir que grupos, seleÃ§Ãµes e jogos estejam consistentes;
* impedir importaÃ§Ã£o com dados incompletos ou invÃ¡lidos.

#### `npm run seed:worldcup:dry`

Deve:

* simular a importaÃ§Ã£o;
* validar o que seria importado;
* nÃ£o gravar nada no Supabase.

#### `npm run seed:worldcup`

Deve:

* importar os dados validados para o Supabase;
* fazer upsert de seleÃ§Ãµes;
* fazer upsert de grupos;
* fazer upsert de relaÃ§Ã£o grupo/seleÃ§Ã£o;
* fazer upsert de jogos;
* nÃ£o apagar dados;
* nÃ£o fazer truncate;
* nÃ£o tocar em `predictions`;
* nÃ£o apagar palpites dos usuÃ¡rios.

---

## Arquivos da importaÃ§Ã£o OpenFootball

Arquivos principais:

```txt
scripts/fetch-world-cup-2026.ts
scripts/validate-world-cup-2026.ts
scripts/import-world-cup-2026.ts
lib/world-cup/openFootballAdapter.ts
lib/world-cup/validateWorldCupData.ts
lib/world-cup/teamCodeMap.ts
lib/world-cup/teamNamePtBrMap.ts
types/worldCupData.ts
data/world-cup-2026.ts
data/raw/openfootball-worldcup-2026.json
```

### `types/worldCupData.ts`

Define o formato interno dos dados da Copa.

Tipos esperados:

```txt
WorldCupTeamSeed
WorldCupMatchSeed
WorldCupGroupSeed
WorldCupSeedData
```

### `data/world-cup-2026.ts`

Arquivo gerado pelo script `fetch:worldcup`.

Deve exportar:

```txt
worldCup2026Data
```

Esse arquivo Ã© a fonte versionada final que o script de importaÃ§Ã£o usa.

### `lib/world-cup/openFootballAdapter.ts`

ResponsÃ¡vel por converter o JSON bruto da OpenFootball para o formato interno.

Deve:

* encontrar jogos;
* filtrar apenas fase de grupos;
* converter `Group A` para `Grupo A`;
* montar seleÃ§Ãµes por grupo;
* montar jogos por grupo;
* converter rodada para `roundNumber`;
* converter nomes de times para cÃ³digos usando `teamCodeMap`;
* converter nomes para portuguÃªs usando `teamNamePtBrMap`, quando existir;
* preservar dados opcionais como data, horÃ¡rio, estÃ¡dio, cidade e paÃ­s quando disponÃ­veis;
* nÃ£o inventar dados.

### `lib/world-cup/teamCodeMap.ts`

Mapeia nomes da OpenFootball para cÃ³digos.

Exemplo:

```txt
Mexico -> MEX
South Africa -> RSA
Brazil -> BRA
Argentina -> ARG
```

Regras:

* Todo time precisa ter cÃ³digo.
* Se faltar cÃ³digo, o script deve falhar.
* NÃ£o gerar arquivo final com time sem cÃ³digo.

### `lib/world-cup/teamNamePtBrMap.ts`

Mapeia nomes em inglÃªs para portuguÃªs.

Exemplo:

```txt
Mexico -> MÃ©xico
South Africa -> Ãfrica do Sul
South Korea -> Coreia do Sul
```

Regras:

* TraduÃ§Ã£o Ã© opcional.
* Se existir traduÃ§Ã£o, usar no arquivo final.
* Se nÃ£o existir traduÃ§Ã£o, usar nome original.
* Falta de traduÃ§Ã£o nÃ£o deve bloquear geraÃ§Ã£o.
* Falta de cÃ³digo deve bloquear geraÃ§Ã£o.

---

## ValidaÃ§Ã£o dos dados da Copa

A validaÃ§Ã£o deve garantir:

* exatamente 12 grupos;
* exatamente 4 seleÃ§Ãµes por grupo;
* exatamente 48 seleÃ§Ãµes;
* exatamente 72 jogos de fase de grupos;
* exatamente 6 jogos por grupo;
* rodadas 1, 2 e 3 em cada grupo;
* exatamente 2 jogos por rodada em cada grupo;
* cada seleÃ§Ã£o joga exatamente 3 vezes;
* nÃ£o existe time contra ele mesmo;
* os times do jogo pertencem ao mesmo grupo;
* nÃ£o existe confronto duplicado no mesmo grupo;
* `fifaMatchNumber` nÃ£o duplica, quando existir;
* cÃ³digos das seleÃ§Ãµes sÃ£o Ãºnicos;
* nomes das seleÃ§Ãµes sÃ£o Ãºnicos;
* `kickoffAt`, quando existir, Ã© data vÃ¡lida.

Se a validaÃ§Ã£o falhar:

* listar todos os erros;
* encerrar com erro;
* nÃ£o importar;
* nÃ£o sobrescrever arquivo final no fetch.

---

## Comandos de dados da Copa

Scripts esperados no `package.json`:

```json
{
  "fetch:worldcup": "tsx scripts/fetch-world-cup-2026.ts",
  "validate:worldcup": "tsx scripts/validate-world-cup-2026.ts",
  "seed:worldcup": "tsx scripts/import-world-cup-2026.ts",
  "seed:worldcup:dry": "tsx scripts/import-world-cup-2026.ts --dry-run"
}
```


---

## VariÃ¡veis de ambiente

### Supabase frontend/server

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase scripts locais

```env
SUPABASE_SERVICE_ROLE_KEY=
```

A `SUPABASE_SERVICE_ROLE_KEY` deve ser usada apenas em scripts locais/server-side.

Nunca expor no frontend.

### OpenFootball

```env
OPENFOOTBALL_WORLD_CUP_2026_URL=
```

Opcional.

Usada somente pelo script `fetch:worldcup`.

NÃ£o usar `NEXT_PUBLIC_`.

### Futuro placar ao vivo/API externa

```env
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
SCORES_SYNC_SECRET=
```

Essas variÃ¡veis sÃ£o para etapa futura de placar.

NÃ£o usar no frontend.

---

## IntegraÃ§Ã£o futura de placares

A OpenFootball serÃ¡ usada apenas para dados estÃ¡ticos.

Para placares no dia dos jogos, a ideia futura Ã© usar uma segunda integraÃ§Ã£o server-side, como API-Football/API-Sports ou outra fonte de placar.

Arquitetura futura:

```txt
API de placar
â†“
rota server-side protegida
â†“
Supabase matches
â†“
app mostra placar separado do palpite
```

Regras futuras:

* NÃ£o chamar API de placar no frontend.
* NÃ£o expor API key no client.
* NÃ£o criar polling infinito no frontend.
* AtualizaÃ§Ã£o pode ser manual via admin ou rota protegida.
* Predictions dos usuÃ¡rios nunca devem ser apagadas pela sincronizaÃ§Ã£o.
* Placar real/live nÃ£o substitui o palpite do usuÃ¡rio.
* Placar real deve aparecer separado do input de palpite.

Exemplo de rota futura:

```txt
POST /api/scores/sync
```

Body:

```json
{
  "date": "2026-06-11"
}
```

ProteÃ§Ã£o:

```txt
x-sync-secret: valor de SCORES_SYNC_SECRET
```

---

## Seed mockado

O arquivo `supabase/seed.sql` pode existir para desenvolvimento inicial.

Mas ele deve estar claramente marcado como mock/dev.

ProduÃ§Ã£o deve usar:

```txt
npm run fetch:worldcup
npm run validate:worldcup
npm run seed:worldcup:dry
npm run seed:worldcup
```

O seed mockado nÃ£o deve ser tratado como fonte oficial.

---

## Ordem de implementaÃ§Ã£o recomendada

### Fase 1 - Base do projeto

1. Criar projeto Next.js.
2. Configurar TypeScript.
3. Configurar Tailwind.
4. Configurar Supabase SSR/cookies.
5. Criar `.env.example`.
6. Criar Git local, sem commit.

### Fase 2 - Banco e Auth

1. Criar tabelas.
2. Criar constraints.
3. Ativar RLS.
4. Criar RPC de convite.
5. Criar login.
6. Criar cadastro por convite.
7. Proteger dashboard.

### Fase 3 - Fase de grupos e palpites

1. Criar `/dashboard/groups`.
2. Buscar grupos, seleÃ§Ãµes, jogos e palpites do Supabase.
3. Renderizar grupos em cards.
4. Renderizar tabela do grupo.
5. Renderizar jogos por rodada.
6. Criar inputs de palpite.
7. Implementar salvamento automÃ¡tico com debounce.
8. Garantir que sÃ³ salva quando o usuÃ¡rio altera input.

### Fase 4 - Visual

1. Criar tema escuro padrÃ£o.
2. Criar tema claro opcional.
3. Criar `ThemeProvider`.
4. Criar `ThemeToggle`.
5. Melhorar header.
6. Melhorar login/cadastro.
7. Melhorar cards dos grupos.
8. Melhorar cards dos jogos.
9. Melhorar inputs.

### Fase 5 - AdministraÃ§Ã£o simples

1. Criar `/dashboard/admin`.
2. Permitir acesso apenas para owner.
3. Listar participantes.
4. Gerar convites.
5. Copiar links de convite.
6. Mostrar link Admin no header apenas para owner.

### Fase 6 - Dados oficiais com OpenFootball

1. Criar/ajustar `fetch:worldcup`.
2. Criar/ajustar adapter da OpenFootball.
3. Criar/ajustar mapeamento de cÃ³digos.
4. Criar/ajustar mapeamento de nomes em portuguÃªs.
5. Gerar `data/world-cup-2026.ts`.
6. Validar dados.
7. Importar para Supabase em dry-run.
8. Importar para Supabase real.

### Fase 7 - Futuro placar

1. Escolher API de placar.
2. Criar integraÃ§Ã£o server-side.
3. Mapear fixtures da API com `matches`.
4. Atualizar placares por rota/admin.
5. Mostrar placar real separado do palpite.
6. SÃ³ depois pensar em pontuaÃ§Ã£o/ranking.

---

## Fora do escopo atual

NÃ£o implementar agora:

* mata-mata;
* ranking;
* pontuaÃ§Ã£o do bolÃ£o;
* placar ao vivo;
* resultados em tempo real;
* cron job;
* polling infinito;
* pagamentos;
* mÃºltiplos bolÃµes avanÃ§ados;
* recuperaÃ§Ã£o de senha avanÃ§ada;
* ediÃ§Ã£o manual de jogos pela interface;
* painel administrativo completo;
* API externa no frontend.

---

## CritÃ©rio de pronto do MVP da fase de grupos

O MVP estarÃ¡ pronto quando:

* usuÃ¡rio owner consegue entrar;
* owner consegue gerar convite;
* usuÃ¡rio convidado consegue criar conta pelo convite;
* usuÃ¡rio convidado entra no bolÃ£o;
* usuÃ¡rio vÃª grupos e jogos;
* usuÃ¡rio navega entre rodadas;
* usuÃ¡rio preenche palpites;
* palpites salvam automaticamente;
* trocar rodada nÃ£o salva nada sozinho;
* recarregar pÃ¡gina mantÃ©m os palpites;
* usuÃ¡rio nÃ£o vÃª palpites de outros usuÃ¡rios;
* member nÃ£o acessa admin;
* owner acessa admin;
* dados oficiais sÃ£o importados para Supabase via OpenFootball;
* app lÃª dados do Supabase;
* lint e build passam.
