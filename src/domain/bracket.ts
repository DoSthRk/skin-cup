import type { Skin, TournamentState } from './types';

export interface RoundDescriptor {
  readonly title: string;
  readonly entrantCount: number;
  readonly matchCount: number;
}

export interface BracketMatchResult {
  readonly matchNumber: number;
  readonly skins: readonly [Skin, Skin];
  readonly winner: Skin;
}

export interface BracketRoundResult {
  readonly descriptor: RoundDescriptor;
  readonly matches: readonly BracketMatchResult[];
}

export function getRoundDescriptor(
  bracketSize: number,
  roundIndex: number,
): RoundDescriptor {
  const entrantCount = bracketSize / 2 ** roundIndex;

  if (
    !Number.isInteger(bracketSize) ||
    bracketSize < 2 ||
    (bracketSize & (bracketSize - 1)) !== 0 ||
    !Number.isInteger(roundIndex) ||
    roundIndex < 0 ||
    !Number.isInteger(entrantCount) ||
    entrantCount < 2
  ) {
    throw new Error('无效的淘汰赛轮次');
  }

  return {
    title:
      entrantCount === 2
        ? '决赛'
        : entrantCount === 4
          ? '半决赛'
          : `1/${entrantCount / 2} 决赛`,
    entrantCount,
    matchCount: entrantCount / 2,
  };
}

export function deriveBracketRounds(
  state: TournamentState,
): readonly BracketRoundResult[] {
  if (state.phase !== 'complete' || !state.champion || !state.runnerUp) {
    throw new Error('赛事尚未完成，无法生成完整晋级图');
  }

  const expectedRoundCount = Math.log2(state.config.bracketSize);
  if (state.bracket.length !== expectedRoundCount) {
    throw new Error('赛事对阵数据不完整，无法生成完整晋级图');
  }

  return state.bracket.map((round, roundIndex) => {
    const descriptor = getRoundDescriptor(state.config.bracketSize, roundIndex);
    if (round.length !== descriptor.matchCount) {
      throw new Error('赛事对阵数据不完整，无法生成完整晋级图');
    }

    return {
      descriptor,
      matches: round.map((match, matchIndex) => {
        if (
          !match.winner ||
          !match.skins.some((skin) => skin.id === match.winner?.id)
        ) {
          throw new Error('赛事对阵数据不完整，无法生成完整晋级图');
        }

        return {
          matchNumber: matchIndex + 1,
          skins: match.skins,
          winner: match.winner,
        };
      }),
    };
  });
}
