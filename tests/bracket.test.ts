import { skinCatalog } from '../src/data/generated-skin-catalog';
import { deriveBracketRounds, getRoundDescriptor } from '../src/domain/bracket';
import { weaponConfigs } from '../src/domain/catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
} from '../src/domain/tournament';
import type { TournamentState, WeaponId } from '../src/domain/types';

function completedState(weapon: WeaponId): TournamentState {
  let state = createTournament(
    skinCatalog.filter((skin) => skin.weapon === weapon),
    weaponConfigs[weapon],
    `completed-${weapon}-bracket`,
  );

  while (state.phase === 'groups') {
    state = confirmGroupPick(
      state,
      state.groups[state.groupIndex]
        .slice(0, state.config.picksPerGroup)
        .map((skin) => skin.id),
    );
  }

  if (state.phase === 'revival') {
    state = confirmWildcards(
      state,
      state.losers.slice(0, state.config.wildcardSlots).map((skin) => skin.id),
    );
  }

  while (state.phase === 'knockout') {
    const match = state.bracket[state.roundIndex][state.matchIndex];
    state = chooseWinner(state, match.skins[0].id);
  }

  return state;
}

describe('knockout round descriptors', () => {
  it('names every round in a 64-entry bracket', () => {
    expect(
      Array.from({ length: 6 }, (_, roundIndex) =>
        getRoundDescriptor(64, roundIndex).title,
      ),
    ).toEqual([
      '1/32 决赛',
      '1/16 决赛',
      '1/8 决赛',
      '1/4 决赛',
      '半决赛',
      '决赛',
    ]);
  });

  it('names every round in a 32-entry bracket', () => {
    expect(getRoundDescriptor(32, 0)).toEqual({
      title: '1/16 决赛',
      entrantCount: 32,
      matchCount: 16,
    });
    expect(getRoundDescriptor(32, 1).title).toBe('1/8 决赛');
    expect(getRoundDescriptor(32, 2).title).toBe('1/4 决赛');
    expect(getRoundDescriptor(32, 3).title).toBe('半决赛');
    expect(getRoundDescriptor(32, 4).title).toBe('决赛');
  });

  it('starts a 16-entry bracket at the round of sixteen', () => {
    expect(getRoundDescriptor(16, 0)).toEqual({
      title: '1/8 决赛',
      entrantCount: 16,
      matchCount: 8,
    });
  });

  it('rejects invalid bracket sizes and round indexes', () => {
    expect(() => getRoundDescriptor(12, 0)).toThrow('无效的淘汰赛轮次');
    expect(() => getRoundDescriptor(16, -1)).toThrow('无效的淘汰赛轮次');
    expect(() => getRoundDescriptor(16, 4)).toThrow('无效的淘汰赛轮次');
  });
});

describe('complete bracket derivation', () => {
  it('derives all 63 matches from a completed melee tournament', () => {
    const rounds = deriveBracketRounds(completedState('melee'));

    expect(rounds.map((round) => round.matches.length)).toEqual([32, 16, 8, 4, 2, 1]);
    expect(rounds.flatMap((round) => round.matches)).toHaveLength(63);
  });

  it('preserves every completed match and its winner', () => {
    const state = completedState('sheriff');
    const rounds = deriveBracketRounds(state);

    expect(rounds.map((round) => round.descriptor.title)).toEqual([
      '1/8 决赛',
      '1/4 决赛',
      '半决赛',
      '决赛',
    ]);
    expect(rounds.flatMap((round) => round.matches)).toHaveLength(15);
    expect(
      rounds.flatMap((round) => round.matches).every((match) => match.winner !== null),
    ).toBe(true);
    expect(rounds.at(-1)?.matches[0].winner).toBe(state.champion);
  });

  it('rejects an incomplete tournament', () => {
    const complete = completedState('sheriff');
    expect(() => deriveBracketRounds({ ...complete, phase: 'knockout' })).toThrow(
      '赛事尚未完成',
    );
  });
});
