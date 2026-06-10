# Regras de pontuacao

O ranking do bolao usa uma regra simples, sem perda de pontos.

## Pontuacao

- 3 pontos: placar exato.
- 1 ponto: resultado correto.
- 0 pontos: resultado errado.

Placar exato nao soma ponto extra de resultado correto. Um palpite exato vale sempre 3 pontos.

## Resultado correto

Resultado correto significa acertar o tipo de resultado do jogo:

- vitoria do mandante;
- empate;
- vitoria do visitante.

Exemplo com resultado real Brasil 2 x 1 Argentina:

- Palpite 2 x 1: 3 pontos, placar exato.
- Palpite 1 x 0: 1 ponto, vitoria do mandante.
- Palpite 3 x 2: 1 ponto, vitoria do mandante.
- Palpite 1 x 1: 0 pontos.
- Palpite 1 x 2: 0 pontos.

Exemplo com empate real Brasil 1 x 1 Argentina:

- Palpite 1 x 1: 3 pontos, placar exato.
- Palpite 0 x 0: 1 ponto, empate correto.
- Palpite 2 x 2: 1 ponto, empate correto.
- Palpite 2 x 1: 0 pontos.

## Jogos sem resultado

Jogos sem resultado real nao contam para a classificacao.

Um jogo sem resultado real e aquele em que `matches.home_score` ou `matches.away_score` esta `null`.

## Palpites incompletos

Palpites incompletos nao pontuam.

Um palpite incompleto e aquele em que `predictions.home_score` ou `predictions.away_score` esta `null`.

## Classificacao

A classificacao e calculada sob demanda. Nao existe tabela de ranking e a pontuacao nao e salva no banco nesta etapa.

Existem dois modos na tela `/dashboard/leaderboard`:

- Ranking geral: soma todos os jogos que ja possuem resultado real.
- Ranking por rodada: filtra apenas jogos da rodada selecionada usando `matches.round_number`.

Os dois modos usam a mesma regra de pontuacao 3/1/0.

O desempate segue esta ordem:

1. pontos totais;
2. placares exatos;
3. resultados corretos;
4. palpites completos feitos;
5. nome do participante.

O ranking mostra estatisticas agregadas dos participantes, sem exibir palpites individuais de outros usuarios.
