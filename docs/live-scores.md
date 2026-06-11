# Placar ao vivo

O placar ao vivo usa um fluxo server-side para economizar requests e proteger a
API key:

```txt
API-Football
-> /api/scores/sync
-> Supabase matches
-> /dashboard/groups
```

O frontend nunca chama a API externa.

## Providers

O provider e escolhido por:

```env
LIVE_SCORE_PROVIDER=football-data
```

Valores:

```txt
api-football
football-data
manual
```

Provider automatico recomendado para Copa 2026:

```env
LIVE_SCORE_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=
FOOTBALL_DATA_COMPETITION_CODE=WC
```

O provider `football-data` usa apenas endpoints por matchday:

```txt
/v4/competitions/WC/matches?matchday=1
/v4/competitions/WC/matches?matchday=2
/v4/competitions/WC/matches?matchday=3
```

O endpoint `/v4/competitions/WC` pode retornar 403 no plano atual e nao deve
ser dependencia obrigatoria.

Observacao importante: a API-Football Free retornou que nao libera `season=2026`.
Ela continua implementada, mas pode exigir plano pago ou outro `league/season`.

Para fallback garantido, use:

```env
LIVE_SCORE_PROVIDER=manual
```

Nesse modo, `/api/scores/sync` nao chama API externa e o owner atualiza o placar
pelo admin.

Se `LIVE_SCORE_PROVIDER` nao estiver definido, o app usa `manual` como fallback
seguro e registra um aviso server-side. Isso evita tentar API-Football por
engano durante a operacao inicial.

## Operacao recomendada para placar automatico

Use football-data como provider principal:

```env
LIVE_SCORE_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=SUA_KEY
FOOTBALL_DATA_COMPETITION_CODE=WC
SCORES_SYNC_SECRET=um_secret_forte
```

Depois rode:

```bash
npm run scores:map-fixtures:dry
npm run scores:map-fixtures
```

Para fase de grupos, o mapeamento busca matchday 1, 2 e 3. Na sync automatica,
o endpoint busca apenas os matchdays ativos em janela de jogo.

## Operacao manual de emergencia

Use o modo manual quando a API atrasar, cair, falhar ou algum jogo nao mapear:

```env
LIVE_SCORE_PROVIDER=manual
SCORES_SYNC_SECRET=um_secret_forte
```

Checklist de operacao:

1. Entrar como owner.
2. Abrir `/dashboard/admin`.
3. Conferir `Provider de placar: manual`.
4. Atualizar placar live na secao `Placar dos jogos`.
5. Conferir `/dashboard/groups`.
6. Finalizar o jogo apos o apito final.
7. Conferir `/dashboard/leaderboard`.

Notas:

* API-Football Free nao acessa a temporada 2026.
* football-data e o provider automatico principal viavel para Copa 2026.
* manual continua como fallback seguro para emergencia.

## Variaveis de ambiente

```env
API_FOOTBALL_KEY=
LIVE_SCORE_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=
FOOTBALL_DATA_COMPETITION_CODE=WC
SCORES_SYNC_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

O mapeamento de fixtures tambem aceita estes opcionais:

```env
API_FOOTBALL_WORLD_CUP_LEAGUE_ID=
API_FOOTBALL_WORLD_CUP_SEASON=
```

Padroes atuais:

```txt
league = 1
season = 2026
```

## Banco

Rode a migration:

```txt
supabase/migrations/0015_live_scores.sql
supabase/migrations/0016_live_score_provider_and_admin.sql
supabase/migrations/0017_live_score_sync_logs.sql
```

Ela adiciona em `matches`:

```txt
api_football_fixture_id
score_provider
score_provider_fixture_id
status_short
status_long
elapsed
home_score_live
away_score_live
score_updated_at
```

A migration `0016` adiciona os campos genericos de provider e RPCs seguras para
o fallback manual no admin.

A migration `0017` cria `live_score_sync_logs`, usada pelo admin para monitorar
ultimas execucoes do sync, erros, jogos ativos e quantidade de jogos atualizados.
Somente owners conseguem ler esses logs pelo app. O endpoint server-side grava
apenas resumo operacional e nunca salva keys ou secrets.

## Mapear fixtures

Antes do sync automatico funcionar, cada jogo precisa estar mapeado ao provider.
Para providers novos, o app usa:

```txt
score_provider
score_provider_fixture_id
```

Dry-run:

```bash
npm run scores:map-fixtures:dry
```

Aplicar:

```bash
npm run scores:map-fixtures
```

Com `LIVE_SCORE_PROVIDER=football-data`, o script busca:

```txt
matchday 1
matchday 2
matchday 3
```

O script so atualiza matches quando encontra uma correspondencia segura por:

```txt
round_number = matchday
home_team.code = homeTeam.tla
away_team.code = awayTeam.tla
kickoff_at proximo de utcDate
```

Se houver duvida, preencha manualmente:

```sql
update public.matches
set api_football_fixture_id = 123456
where id = 'MATCH_ID';
```

Para football-data:

```env
LIVE_SCORE_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=
FOOTBALL_DATA_COMPETITION_CODE=WC
```

Depois rode:

```bash
npm run scores:map-fixtures:dry
npm run scores:map-fixtures
```

Dry-run esperado:

```txt
matchday 1 fixtures: 24
matchday 2 fixtures: 24
matchday 3 fixtures: 24
total football-data fixtures: 72
```

## Endpoint de sync

Chamada manual:

```txt
/api/scores/sync?secret=SCORES_SYNC_SECRET
```

Tambem aceita header:

```txt
x-sync-secret: SCORES_SYNC_SECRET
```

Respostas esperadas:

```json
{
  "status": "synced",
  "reason": "active_match_window",
  "externalRequests": 1,
  "updatedMatches": 2,
  "nextRecommendedSyncInMinutes": 3
}
```

```json
{
  "status": "skipped",
  "reason": "outside_active_window",
  "externalRequests": 0,
  "updatedMatches": 0
}
```

## Economia de requests

O endpoint consulta `matches` antes de chamar a API externa.

Janela ativa:

```txt
5 minutos antes do kickoff
ate 2h15 depois do kickoff
```

Intervalo minimo por quantidade de horarios no dia:

```txt
1-2 horarios: 3 min
3 horarios: 4 min
4 horarios: 5 min
5+ horarios: 7 min
```

Pausa no intervalo:

```txt
Se todos os jogos ativos estiverem HT e a ultima sync tem menos de 15 min,
o endpoint nao chama a API externa.
```

## Cron

Configure um cron para chamar o endpoint a cada 1 ou 2 minutos durante a Copa.
O endpoint decide internamente se deve gastar request externo.

Exemplo:

```txt
GET https://SEU_DOMINIO/api/scores/sync?secret=SCORES_SYNC_SECRET
```

Se `LIVE_SCORE_PROVIDER=manual`, o endpoint retorna `manual_provider` e nao
gasta requests externos.

Se `LIVE_SCORE_PROVIDER=football-data`, o endpoint chama apenas matchdays ativos
com jogos dentro da janela ativa. Ele nao busca matchday 1, 2 e 3 em toda sync.

## Monitoramento no admin

Owners veem a secao `Status do placar ao vivo` em `/dashboard/admin`.

Ela mostra:

* provider atual;
* ultimo sync;
* ultimo sucesso;
* ultimo erro;
* jogos em janela ativa;
* proximo jogo;
* historico recente;
* alerta visual quando a ultima falha ainda nao foi superada por sucesso.

O botao `Rodar sincronizacao agora` chama uma rota admin-only server-side e nao
envia `SCORES_SYNC_SECRET` para o navegador.

## Uso na tela

`/dashboard/groups` mostra:

* `AO VIVO` para jogos em andamento;
* `Intervalo` para `HT`;
* `Finalizado` para `FT`, `AET` ou `PEN`;
* horario do jogo quando ainda nao iniciou.

A classificacao real do grupo usa:

```txt
1. home_score/away_score se finalizado
2. home_score_live/away_score_live se em andamento ou intervalo
3. ignora jogo nao iniciado
```

O ranking dos usuarios continua usando somente:

```txt
matches.home_score
matches.away_score
```

## Teste sem jogo real

### Pelo admin

1. Entrar como owner.
2. Abrir `/dashboard/admin`.
3. Usar a secao `Placar dos jogos`.
4. Preencher placar live, status e minuto.
5. Clicar em `Salvar`.
6. Abrir `/dashboard/groups` e confirmar `AO VIVO`.
7. Clicar em `Finalizar` para gravar `home_score` e `away_score`.

### Via SQL

Simular jogo ao vivo:

```sql
update public.matches
set
  home_score_live = 1,
  away_score_live = 0,
  status_short = '1H',
  status_long = 'First Half',
  elapsed = 35,
  score_updated_at = now()
where id = 'MATCH_ID';
```

Simular intervalo:

```sql
update public.matches
set
  status_short = 'HT',
  status_long = 'Halftime',
  score_updated_at = now()
where id = 'MATCH_ID';
```

Finalizar jogo:

```sql
update public.matches
set
  home_score = coalesce(home_score_live, 1),
  away_score = coalesce(away_score_live, 0),
  status_short = 'FT',
  status_long = 'Match Finished',
  score_updated_at = now()
where id = 'MATCH_ID';
```

## Fallback manual

Se API ou cron falhar durante um jogo, atualize os campos live manualmente no
Supabase. Quando terminar, preencha `home_score` e `away_score`; so esses campos
entram no ranking dos usuarios.
