# Bolao Copa do Mundo

Aplicacao web de bolao para Copa do Mundo, feita com Next.js e Supabase, com autenticacao, boloes, palpites por partida, rankings e uma experiencia de mata-mata em formato de bracket.

O projeto comecou como uma brincadeira entre amigos e evoluiu para um MVP publico de portfolio. Ele explora regras reais de produto, autenticacao, autorizacao, rankings, persistencia de palpites e sincronizacao de dados esportivos.

## Sobre o projeto

O Bolao Copa do Mundo permite que usuarios participem de um bolao geral, criem boloes privados, convidem amigos e registrem palpites para jogos da competicao.

A aplicacao foi pensada para lidar com diferentes fases do torneio: fase de grupos, mata-mata e classificacao geral. As regras criticas, como bloqueio de palpites, permissao de acesso e calculo de rankings, ficam centralizadas no banco ou em RPCs do Supabase sempre que necessario.

## Funcionalidades

- Autenticacao com Supabase Auth
- Cadastro, login e recuperacao de senha
- Bolao geral automatico para novos usuarios
- Criacao de boloes privados
- Convites por link ou codigo
- Palpites de placar por partida
- Palpite global por usuario e partida
- Ranking por bolao
- Classificacao geral
- Ranking da fase de grupos
- Ranking do mata-mata
- Ranking por rodada e ranking ao vivo
- Palpites progressivos do mata-mata em formato de bracket oficial
- Auto-save das escolhas do mata-mata
- Bloqueio de palpites antes dos jogos
- Aviso global quando o mata-mata estiver disponivel
- Painel administrativo para ajustes controlados
- Scripts de sincronizacao com modo dry-run

## Principais decisoes tecnicas

### Palpite global por partida

O usuario registra um unico palpite por partida. Esse palpite vale para todos os boloes em que ele participa.

Essa decisao evita duplicidade de dados, simplifica a experiencia do usuario e permite calcular rankings por bolao apenas filtrando os membros participantes.

### Ranking por bolao

Os rankings sao calculados a partir dos membros de cada bolao. O sistema reutiliza os palpites globais dos usuarios e monta a classificacao de acordo com o contexto do bolao selecionado.

### Bolao geral automatico

Todo usuario autenticado pode ser associado automaticamente a um bolao geral. Isso garante que a pessoa consiga usar a aplicacao sem precisar criar ou entrar em um bolao privado primeiro.

### Boloes privados com convite

Usuarios podem criar boloes privados e convidar outras pessoas por link ou codigo. O acesso ao ranking e aos dados do bolao respeita a participacao do usuario.

### Mata-mata por confronto real

No mata-mata, o usuario palpita o vencedor de cada confronto real definido. A visualizacao segue o bracket oficial do torneio, mas as escolhas do usuario nao propagam times para fases futuras.

### Auto-save

Cada escolha no mata-mata atualiza o estado local e dispara salvamento automatico daquele confronto. O usuario pode preencher os jogos aos poucos conforme os confrontos reais forem definidos.

### Bloqueio por jogo

Regras sensiveis, como impedir edicoes depois do prazo, nao dependem apenas do front-end. O banco tambem valida que cada confronto bloqueia 10 minutos antes do proprio inicio.

### Pontuacao separada

A fase de grupos e o mata-mata possuem pontuacoes separadas. A classificacao geral soma os pontos das duas fases, permitindo comparar o desempenho total sem perder a visao por etapa.

### Scripts com dry-run

Scripts de sincronizacao foram pensados para mostrar o que sera alterado antes de gravar qualquer dado. Isso reduz risco ao atualizar placares, fixtures ou confrontos do mata-mata.

## Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL
- Supabase RPCs e RLS
- Tailwind CSS
- Vercel
- Scripts Node/TypeScript para sincronizacao de dados

## Arquitetura geral

O projeto combina uma aplicacao Next.js com Supabase como backend principal.

- O front-end renderiza as telas de autenticacao, dashboard, grupos, rankings, boloes e mata-mata.
- O Supabase Auth gerencia cadastro, login e sessao dos usuarios.
- O PostgreSQL armazena usuarios, boloes, membros, convites, partidas, palpites, rankings e mata-mata.
- RPCs do Supabase concentram regras criticas, como salvar palpites, validar permissao e calcular rankings.
- Scripts locais ou server-side fazem sincronizacao de dados esportivos e validam alteracoes com dry-run.
- Regras de seguranca usam RLS, funcoes com `security definer` e validacoes explicitas de usuario autenticado.

## Como funciona o sistema de palpites

Na fase de grupos, o usuario faz palpites de placar para cada partida.

O palpite pertence ao par:

```txt
user_id + match_id
```

Isso significa que o usuario palpita uma vez por jogo. Se ele participa de varios boloes, o mesmo palpite e usado em todos eles.

O ranking de cada bolao e calculado buscando os membros daquele bolao e comparando os palpites deles com os resultados oficiais das partidas.

## Como funciona o mata-mata

O mata-mata e uma aposta separada dos palpites de placar.

O fluxo e:

1. O usuario acessa a tela de Mata-mata.
2. O sistema exibe os confrontos oficiais definidos.
3. O usuario escolhe o vencedor de cada jogo real disponivel.
4. Cada clique salva automaticamente apenas aquele palpite.
5. Confrontos sem times definidos ficam bloqueados.
6. Cada confronto bloqueia 10 minutos antes do proprio inicio.
7. As fases seguintes seguem os classificados oficiais, nao os palpites do usuario.
8. O usuario pode errar um classificado e continuar palpitando normalmente nos jogos reais seguintes.

O conjunto de palpites e global por usuario e torneio:

```txt
user_id + tournament_key
```

Ele nao pertence a um bolao especifico. Para rankings, os pontos sao calculados filtrando apenas os membros de cada bolao.

## Pontuacao

### Fase de grupos

A fase de grupos usa a pontuacao tradicional de palpites de placar:

- Placar exato: 3 pontos
- Resultado correto: 1 ponto
- Palpite incorreto: 0 pontos

### Mata-mata

O mata-mata pontua acertos do vencedor de cada confronto real, nao placar.

- Acerto do vencedor: 2 pontos
- Bonus de sequencia: quantidade de confrontos anteriores da arvore daquele jogo
- O bonus so entra se o usuario acertou todos os confrontos anteriores que formaram aquela partida
- Se qualquer confronto anterior obrigatorio foi errado, o jogo vale apenas os 2 pontos base

### Rankings

A aplicacao suporta diferentes leituras da classificacao:

- Geral: fase de grupos + mata-mata
- Fase de grupos: apenas palpites de placar
- Mata-mata: apenas pontos dos confrontos oficiais
- Por rodada
- Ao vivo, quando os resultados estao sendo atualizados

## Scripts de sincronizacao

O projeto possui scripts para auxiliar na manutencao dos dados da competicao:

- Mapear fixtures de partidas
- Sincronizar placares
- Validar resultados em dry-run
- Mapear jogos por provedores externos
- Sincronizar confrontos do mata-mata
- Atualizar confrontos oficiais e vencedores do mata-mata

Comandos uteis:

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

Use comandos reais de sincronizacao apenas depois de configurar o ambiente local, conferir o target e validar o dry-run.

## Variaveis de ambiente

O app publico precisa apenas das variaveis usadas pelo Next.js para conectar ao Supabase.

Exemplo seguro para app local ou Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
```

Se alguma rota server-side administrativa precisar de permissao elevada, use service role apenas no servidor:

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Nunca exponha service role em variaveis `NEXT_PUBLIC_`.

Scripts de placar e sincronizacao usam um arquivo separado, como `.env.scores.local`, ignorado pelo Git:

```env
SCORE_SUPABASE_TARGET=production

SCORE_SUPABASE_PRODUCTION_URL=https://your-production-project.supabase.co
SCORE_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=your_production_service_role_key

SCORE_SUPABASE_STAGING_URL=https://your-staging-project.supabase.co
SCORE_SUPABASE_STAGING_SERVICE_ROLE_KEY=your_staging_service_role_key
```

## Rodando localmente

Instale as dependencias:

```bash
npm install
```

Crie seu arquivo local de ambiente:

```bash
cp .env.example .env.local
```

Preencha as variaveis do Supabase com valores do seu projeto.

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

Comandos de validacao:

```bash
npm run lint
npm run build
```

## Supabase

As migrations ficam em:

```txt
supabase/migrations
```

Elas criam tabelas, constraints, indices, triggers, policies, RPCs e regras necessarias para autenticacao, boloes, rankings, palpites e mata-mata.

Antes de aplicar migrations em producao, valide em um ambiente de teste e faca backup dos dados.

## Seguranca

- Arquivos `.env` reais nao devem ser commitados.
- Chaves `service_role` devem existir apenas em ambiente server-side ou scripts locais.
- O front-end usa apenas chave anonima/publicavel do Supabase.
- Scripts de score usam ambiente separado do app publico.
- Regras criticas ficam no banco/RPC, nao somente no front-end.
- Usuarios comuns nao podem alterar confrontos oficiais ou dados administrativos.
- O ranking de bolao respeita os membros daquele bolao.

## Status do projeto

MVP em evolucao e projeto de portfolio.

O foco atual e manter uma experiencia completa para bolao da Copa do Mundo, cobrindo fase de grupos, mata-mata, rankings e sincronizacao segura de dados esportivos.

## Proximos passos

- Melhorar cobertura de testes automatizados
- Evoluir o painel administrativo
- Adicionar historico detalhado de pontuacao
- Melhorar observabilidade dos scripts de sincronizacao
- Refinar estados em tempo real durante jogos ao vivo
- Criar uma documentacao mais detalhada das RPCs

## Licenca

A definir.
