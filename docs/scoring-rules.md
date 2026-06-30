# Regras de pontuação

O ranking do bolão usa uma regra simples, sem perda de pontos.

## Pontuação

- 3 pontos: placar exato.
- 1 ponto: resultado correto.
- 0 pontos: resultado errado.

Placar exato não soma ponto extra de resultado correto. Um palpite exato vale sempre 3 pontos.

## Resultado correto

Resultado correto significa acertar o tipo de resultado do jogo:

- vitória do mandante;
- empate;
- vitória do visitante.

Exemplo com resultado real Brasil 2 x 1 Argentina:

- Palpite 2 x 1: 3 pontos, placar exato.
- Palpite 1 x 0: 1 ponto, vitória do mandante.
- Palpite 3 x 2: 1 ponto, vitória do mandante.
- Palpite 1 x 1: 0 pontos.
- Palpite 1 x 2: 0 pontos.

Exemplo com empate real Brasil 1 x 1 Argentina:

- Palpite 1 x 1: 3 pontos, placar exato.
- Palpite 0 x 0: 1 ponto, empate correto.
- Palpite 2 x 2: 1 ponto, empate correto.
- Palpite 2 x 1: 0 pontos.

## Jogos sem resultado

Jogos sem resultado real não contam para a classificação.

Um jogo sem resultado real é aquele em que `matches.home_score` ou `matches.away_score` está `null`.

## Palpites incompletos

Palpites incompletos não pontuam.

Um palpite incompleto é aquele em que `predictions.home_score` ou `predictions.away_score` está `null`.

## Classificação

A classificação é calculada sob demanda. Não existe tabela de ranking e a pontuação não é salva no banco nesta etapa.

Existem dois modos na tela `/dashboard/leaderboard`:

- Ranking geral: soma todos os jogos que já possuem resultado real.
- Ranking por rodada: filtra apenas jogos da rodada selecionada usando `matches.round_number`.

Os dois modos usam a mesma regra de pontuação 3/1/0.

O desempate segue esta ordem:

1. pontos totais;
2. placares exatos;
3. resultados corretos;
4. palpites completos feitos;
5. nome do participante.

O ranking mostra estatísticas agregadas dos participantes, sem exibir palpites individuais de outros usuários.
