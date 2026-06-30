# Bolão Copa do Mundo

Aplicação web de bolão para Copa do Mundo, feita com Next.js e Supabase, com autenticação, bolões, palpites por partida, rankings e uma experiência de mata-mata em formato de bracket.

O projeto começou como uma brincadeira entre amigos e evoluiu para um MVP público de portfólio. Ele explora regras reais de produto, autenticação, autorização, rankings, persistência de palpites e sincronização de dados esportivos.

## Sobre o projeto

O Bolão Copa do Mundo permite que usuários participem de um bolão geral, criem bolões privados, convidem amigos e registrem palpites para jogos da competição.

A aplicação foi pensada para lidar com diferentes fases do torneio: fase de grupos, mata-mata e classificação geral. As regras críticas, como bloqueio de palpites, permissão de acesso e cálculo de rankings, ficam centralizadas no banco ou em RPCs do Supabase sempre que necessário.

## Funcionalidades

- Autenticação com Supabase Auth
- Cadastro, login e recuperação de senha
- Bolão geral automático para novos usuários
- Criação de bolões privados
- Convites por link ou código
- Palpites de placar por partida
- Palpite global por usuário e partida
- Ranking por bolão
- Classificação geral
- Ranking da fase de grupos
- Ranking do mata-mata
- Ranking por rodada e ranking ao vivo
- Palpites progressivos do mata-mata em formato de bracket oficial
- Auto-save das escolhas do mata-mata
- Bloqueio de palpites antes dos jogos
- Aviso global quando o mata-mata estiver disponível
- Painel administrativo para ajustes controlados
- Scripts de sincronização com modo dry-run

## Principais decisões técnicas

### Palpite global por partida

O usuário registra um único palpite por partida. Esse palpite vale para todos os bolões em que ele participa.

Essa decisão evita duplicidade de dados, simplifica a experiência do usuário e permite calcular rankings por bolão apenas filtrando os membros participantes.

### Ranking por bolão

Os rankings são calculados a partir dos membros de cada bolão. O sistema reutiliza os palpites globais dos usuários e monta a classificação de acordo com o contexto do bolão selecionado.

### Bolão geral automático

Todo usuário autenticado pode ser associado automaticamente a um bolão geral. Isso garante que a pessoa consiga usar a aplicação sem precisar criar ou entrar em um bolão privado primeiro.

### Bolões privados com convite

Usuários podem criar bolões privados e convidar outras pessoas por link ou código. O acesso ao ranking e aos dados do bolão respeita a participação do usuário.

### Mata-mata por confronto real

No mata-mata, o usuário palpita o vencedor de cada confronto real definido. A visualização segue o bracket oficial do torneio, mas as escolhas do usuário não propagam times para fases futuras.

### Auto-save

Cada escolha no mata-mata atualiza o estado local e dispara salvamento automático daquele confronto. O usuário pode preencher os jogos aos poucos conforme os confrontos reais forem definidos.

### Bloqueio por jogo

Regras sensíveis, como impedir edições depois do prazo, não dependem apenas do front-end. O banco também valida que cada confronto bloqueia 10 minutos antes do próprio início.

### Pontuação separada

A fase de grupos e o mata-mata possuem pontuações separadas. A classificação geral soma os pontos das duas fases, permitindo comparar o desempenho total sem perder a visão por etapa.

### Scripts com dry-run

Scripts de sincronização foram pensados para mostrar o que será alterado antes de gravar qualquer dado. Isso reduz risco ao atualizar placares, fixtures ou confrontos do mata-mata.

## Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL
- Supabase RPCs e RLS
- Tailwind CSS
- Vercel
- Scripts Node/TypeScript para sincronização de dados

## Arquitetura geral

O projeto combina uma aplicação Next.js com Supabase como backend principal.

- O front-end renderiza as telas de autenticação, dashboard, grupos, rankings, bolões e mata-mata.
- O Supabase Auth gerencia cadastro, login e sessão dos usuários.
- O PostgreSQL armazena usuários, bolões, membros, convites, partidas, palpites, rankings e mata-mata.
- RPCs do Supabase concentram regras críticas, como salvar palpites, validar permissão e calcular rankings.
- Scripts locais ou server-side fazem sincronização de dados esportivos e validam alterações com dry-run.
- Regras de segurança usam RLS, funções com `security definer` e validações explícitas de usuário autenticado.

## Como funciona o sistema de palpites

Na fase de grupos, o usuário faz palpites de placar para cada partida.

O palpite pertence ao par:

```txt
user_id + match_id
```

Isso significa que o usuário palpita uma vez por jogo. Se ele participa de vários bolões, o mesmo palpite é usado em todos eles.

O ranking de cada bolão é calculado buscando os membros daquele bolão e comparando os palpites deles com os resultados oficiais das partidas.

## Como funciona o mata-mata

O mata-mata é uma aposta separada dos palpites de placar.

O fluxo é:

1. O usuário acessa a tela de Mata-mata.
2. O sistema exibe os confrontos oficiais definidos.
3. O usuário escolhe o vencedor de cada jogo real disponível.
4. Cada clique salva automaticamente apenas aquele palpite.
5. Confrontos sem times definidos ficam bloqueados.
6. Cada confronto bloqueia 10 minutos antes do próprio início.
7. As fases seguintes seguem os classificados oficiais, não os palpites do usuário.
8. O usuário pode errar um classificado e continuar palpitando normalmente nos jogos reais seguintes.

O conjunto de palpites é global por usuário e torneio:

```txt
user_id + tournament_key
```

Ele não pertence a um bolão específico. Para rankings, os pontos são calculados filtrando apenas os membros de cada bolão.

## Pontuação

### Fase de grupos

A fase de grupos usa a pontuação tradicional de palpites de placar:

- Placar exato: 3 pontos
- Resultado correto: 1 ponto
- Palpite incorreto: 0 pontos

### Mata-mata

O mata-mata pontua acertos do vencedor de cada confronto real, não placar.

- Acerto do vencedor: 2 pontos
- Bônus de sequência: quantidade de confrontos anteriores da árvore daquele jogo
- O bônus só entra se o usuário acertou todos os confrontos anteriores que formaram aquela partida
- Se qualquer confronto anterior obrigatório foi errado, o jogo vale apenas os 2 pontos base

### Rankings

A aplicação suporta diferentes leituras da classificação:

- Geral: fase de grupos + mata-mata
- Fase de grupos: apenas palpites de placar
- Mata-mata: apenas pontos dos confrontos oficiais
- Por rodada
- Ao vivo, quando os resultados estão sendo atualizados

## Scripts de sincronização

O projeto possui scripts para auxiliar na manutenção dos dados da competição:

- Mapear fixtures de partidas
- Sincronizar placares
- Validar resultados em dry-run
- Mapear jogos por provedores externos
- Sincronizar confrontos do mata-mata
- Atualizar confrontos oficiais e vencedores do mata-mata

Comandos úteis:

```bash
npm run scores:map-fixtures:dry
npm run scores:map-fixtures
npm run scores:sync-results:dry
npm run scores:sync-results
npm run knockout:sync:dry
npm run knockout:sync
npm run knockout:sync-espn:dry
npm run knockout:sync-espn
```

Use comandos reais de sincronização apenas depois de configurar o ambiente local, conferir o target e validar o dry-run.

## Variáveis de ambiente

O app público precisa apenas das variáveis usadas pelo Next.js para conectar ao Supabase.

Exemplo seguro para app local ou Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
```

Se alguma rota server-side administrativa precisar de permissão elevada, use service role apenas no servidor:

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Nunca exponha service role em variáveis `NEXT_PUBLIC_`.

Scripts de placar e sincronização usam um arquivo separado, como `.env.scores.local`, ignorado pelo Git:

```env
SCORE_SUPABASE_TARGET=production

SCORE_SUPABASE_PRODUCTION_URL=https://your-production-project.supabase.co
SCORE_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=your_production_service_role_key

SCORE_SUPABASE_STAGING_URL=https://your-staging-project.supabase.co
SCORE_SUPABASE_STAGING_SERVICE_ROLE_KEY=your_staging_service_role_key
```

## Rodando localmente

Instale as dependências:

```bash
npm install
```

Crie seu arquivo local de ambiente:

```bash
cp .env.example .env.local
```

Preencha as variáveis do Supabase com valores do seu projeto.

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

Comandos de validação:

```bash
npm run lint
npm run build
```

## Supabase

As migrations ficam em:

```txt
supabase/migrations
```

Elas criam tabelas, constraints, índices, triggers, policies, RPCs e regras necessárias para autenticação, bolões, rankings, palpites e mata-mata.

Antes de aplicar migrations em produção, valide em um ambiente de teste e faça backup dos dados.

## Segurança

- Arquivos `.env` reais não devem ser commitados.
- Chaves `service_role` devem existir apenas em ambiente server-side ou scripts locais.
- O front-end usa apenas chave anônima/publicável do Supabase.
- Scripts de score usam ambiente separado do app público.
- Regras críticas ficam no banco/RPC, não somente no front-end.
- Usuários comuns não podem alterar confrontos oficiais ou dados administrativos.
- O ranking de bolão respeita os membros daquele bolão.

## Status do projeto

MVP em evolução e projeto de portfólio.

O foco atual é manter uma experiência completa para bolão da Copa do Mundo, cobrindo fase de grupos, mata-mata, rankings e sincronização segura de dados esportivos.

## Próximos passos

- Melhorar cobertura de testes automatizados
- Evoluir o painel administrativo
- Adicionar histórico detalhado de pontuação
- Melhorar observabilidade dos scripts de sincronização
- Refinar estados em tempo real durante jogos ao vivo
- Criar uma documentação mais detalhada das RPCs

## Licença

A definir.
