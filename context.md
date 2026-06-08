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

O projeto deve ter uma aparência moderna inspirada em apps esportivos, bolões e interfaces de apostas, mas sem parecer uma plataforma de aposta com dinheiro real.

A identidade visual deve transmitir:

* Competição entre amigos.
* Copa do Mundo.
* Esporte.
* Palpites.
* Facilidade de uso.
* Visual moderno e limpo.

O tema padrão deve ser escuro.

O usuário deve ter opção de trocar para tema claro.

### Tema escuro padrão

O app deve iniciar em dark mode por padrão.

Sugestão de estilo:

* Fundo principal escuro.
* Cards em tons de slate/zinc.
* Bordas discretas.
* Destaques em verde, amarelo ou azul.
* Inputs de placar bem visíveis.
* Feedback de salvamento claro, mas discreto.

Exemplo de paleta sugerida:

```txt
Background principal: slate-950
Cards: slate-900 ou zinc-900
Cards secundários: slate-800
Bordas: slate-700
Texto principal: slate-50
Texto secundário: slate-400
Destaque positivo: emerald-400 / emerald-500
Destaque esportivo: yellow-400 / amber-400
Ações principais: emerald-500
Erros: red-400
```

### Tema claro opcional

O usuário deve conseguir alternar para tema claro.

O tema claro deve manter a mesma estrutura visual, apenas ajustando cores:

```txt
Background principal: slate-50
Cards: white
Bordas: slate-200
Texto principal: slate-950
Texto secundário: slate-500
Destaque positivo: emerald-600
Ações principais: emerald-600
Erros: red-600
```

### Alternância de tema

Criar um botão de alternância no header.

O botão pode ser simples:

```txt
🌙 Escuro
☀️ Claro
```

Ou apenas ícone.

A preferência do usuário deve ser salva no navegador usando `localStorage`.

Não precisa salvar o tema no Supabase nesta etapa.

Ao abrir o app novamente, o tema escolhido deve ser mantido.

Se não existir preferência salva, usar tema escuro como padrão.

### Estilo geral da interface

A interface deve usar cards mais bonitos e modernos.

Evitar aparência muito básica de formulário/tabela.

Os principais elementos devem ter:

* `rounded-2xl`
* `border`
* `shadow-sm`
* `backdrop-blur` quando fizer sentido
* espaçamento confortável
* estados de hover
* transições suaves

### Layout da página de grupos

A página `/dashboard/groups` deve parecer a tela principal do bolão.

Adicionar um topo/hero discreto com:

* Nome do bolão.
* Texto curto, exemplo: "Faça seus palpites da fase de grupos".
* Indicador da quantidade de grupos.
* Indicador da quantidade de palpites preenchidos pelo usuário.
* Indicador da quantidade de jogos totais.

Exemplo:

```txt
Bolão da Copa
Faça seus palpites da fase de grupos

8 grupos
48 jogos
12 palpites preenchidos
```

### Cards dos grupos

Cada grupo deve parecer um card esportivo.

O card do grupo deve ter:

* Nome do grupo em destaque.
* Badge com quantidade de seleções.
* Tabela do grupo à esquerda.
* Jogos da rodada à direita.
* Rodada atual destacada.
* Botões de rodada com bom visual.

No desktop:

```txt
Grid 12 colunas
Tabela: 8 colunas
Jogos: 4 colunas
```

No mobile:

```txt
Tabela: 12 colunas
Jogos: 12 colunas
```

### Tabela do grupo

A tabela deve ser visualmente limpa.

Melhorias desejadas:

* Cabeçalho discreto.
* Linhas com hover.
* Nome da seleção destacado.
* Código ou bandeira da seleção, se existir.
* Classificação bem alinhada.
* Top 2 posições podem receber destaque visual sutil.

Se ainda não houver cálculo real da tabela, manter tudo zerado, mas com visual final.

### Jogos e palpites

Os jogos precisam parecer cards pequenos.

Cada jogo deve mostrar:

* Time da casa.
* Input do placar da casa.
* Separador "x".
* Input do placar visitante.
* Time visitante.
* Status de salvamento.

Exemplo:

```txt
Brasil      [ 2 ]  x  [ 1 ]      Argentina
Salvo
```

Os inputs devem ser maiores e fáceis de usar.

Sugestão visual:

* Input centralizado.
* Largura fixa.
* Texto grande.
* Borda destacada ao focar.
* Sem aparência padrão feia do navegador.
* Remover setas do input number se possível, usando CSS.

### Feedback de salvamento

Manter o salvamento automático.

Mostrar feedback discreto:

* Salvando...
* Salvo
* Erro ao salvar

Sugestão visual:

```txt
Salvando... em amarelo/amber
Salvo em verde/emerald
Erro ao salvar em vermelho/red
```

Não usar alert.

Não usar modal.

Não bloquear a tela.

### Header

Melhorar o header do dashboard.

Deve ter:

* Nome/logo textual: Bolão da Copa.
* Link para Grupos.
* Botão de alternar tema.
* Botão de sair.
* Visual escuro moderno.

No mobile, o header pode quebrar de forma simples, sem menu complexo nesta etapa.

### Telas de login e cadastro

As telas de login e cadastro também devem seguir o novo visual.

Tema escuro padrão.

Criar um layout mais bonito:

* Card centralizado.
* Título forte.
* Subtítulo curto.
* Inputs modernos.
* Botão principal em destaque.
* Mensagens de erro bem posicionadas.

Exemplo de texto:

```txt
Entre no seu bolão
Acesse seus palpites da Copa do Mundo.
```

Cadastro:

```txt
Entrar no bolão
Crie sua conta usando o convite recebido.
```

### Componentização visual

Se necessário, criar componentes reutilizáveis simples:

```txt
components/ui/Button.tsx
components/ui/Card.tsx
components/ui/Input.tsx
components/ui/Badge.tsx
components/ui/ThemeToggle.tsx
```

Não instalar biblioteca pesada de UI nesta etapa.

Pode usar apenas Tailwind.

### Regras importantes

* Não alterar a regra de negócio.
* Não criar botão de salvar palpite.
* Não alterar o fluxo de convite.
* Não remover RLS nem proteções.
* Não implementar ranking agora.
* Não implementar playoffs agora.
* Foco desta etapa é visual, tema e experiência de uso.
