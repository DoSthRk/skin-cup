import { weaponConfigs } from '../src/domain/catalog';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
  progress,
  restart,
  toggleGroupPick,
  undo,
} from '../src/domain/tournament';
import type { Skin, TournamentState, WeaponConfig, WeaponId } from '../src/domain/types';

const cases = [
  ['vandal', weaponConfigs.vandal, 42, 14, 3, 4, 32],
  ['phantom', weaponConfigs.phantom, 36, 12, 3, 8, 32],
  ['sheriff', weaponConfigs.sheriff, 24, 6, 4, 4, 16],
] as const;

function skinsFor(weapon: WeaponId): Skin[] {
  return skinCatalog.filter((skin) => skin.weapon === weapon);
}

function groupIds(state: TournamentState): string[][] {
  return state.groups.map((group) => group.map((skin) => skin.id));
}

function finishAllGroups(state: TournamentState): TournamentState {
  let current = state;

  while (current.phase === 'groups') {
    current = confirmGroupPick(
      current,
      current.groups[current.groupIndex]
        .slice(0, current.config.picksPerGroup)
        .map((skin) => skin.id),
    );
  }

  return current;
}

function startKnockout(state: TournamentState): TournamentState {
  const grouped = finishAllGroups(state);
  return confirmWildcards(
    grouped,
    grouped.losers.slice(0, grouped.config.wildcardSlots).map((skin) => skin.id),
  );
}

describe.each(cases)(
  '%s tournament configuration',
  (weapon, config, entrantCount, groupCount, groupSize, wildcardSlots, bracketSize) => {
    it('conserves every entrant exactly once and follows configured phase sizes', () => {
      const initial = createTournament(skinsFor(weapon), config, `${weapon}-seed`);
      const groupedIds = initial.groups.flat().map((skin) => skin.id);

      expect(initial.groups).toHaveLength(groupCount);
      expect(initial.groups.map((group) => group.length)).toEqual(
        Array(groupCount).fill(groupSize),
      );
      expect(groupedIds).toHaveLength(entrantCount);
      expect(new Set(groupedIds).size).toBe(entrantCount);
      expect(new Set(groupedIds)).toEqual(new Set(skinsFor(weapon).map((skin) => skin.id)));

      const grouped = finishAllGroups(initial);
      expect(grouped.phase).toBe('revival');
      expect(grouped.qualifiers).toHaveLength(groupCount * config.picksPerGroup);
      expect(grouped.losers).toHaveLength(entrantCount - groupCount * config.picksPerGroup);

      const knockout = confirmWildcards(
        grouped,
        grouped.losers.slice(0, wildcardSlots).map((skin) => skin.id),
      );
      const firstRoundEntrants = knockout.bracket[0].flatMap((match) => match.skins);

      expect(knockout.phase).toBe('knockout');
      expect(knockout.qualifiers).toHaveLength(bracketSize);
      expect(knockout.bracket[0]).toHaveLength(bracketSize / 2);
      expect(firstRoundEntrants).toHaveLength(bracketSize);
      expect(new Set(firstRoundEntrants.map((skin) => skin.id)).size).toBe(bracketSize);
      expect(new Set(firstRoundEntrants.map((skin) => skin.id))).toEqual(
        new Set(knockout.qualifiers.map((skin) => skin.id)),
      );
    });
  },
);

describe('deterministic balanced seeding', () => {
  it('repeats a seed and can produce a different draw from a different seed', () => {
    const skins = skinsFor('vandal');
    const first = createTournament(skins, weaponConfigs.vandal, 'repeatable');
    const repeated = createTournament(skins, weaponConfigs.vandal, 'repeatable');
    const different = createTournament(skins, weaponConfigs.vandal, 'different');

    expect(groupIds(repeated)).toEqual(groupIds(first));
    expect(groupIds(different)).not.toEqual(groupIds(first));
  });

  it('snake-distributes each tier across groups as evenly as capacity permits', () => {
    const state = createTournament(skinsFor('vandal'), weaponConfigs.vandal, 'tier-balance');
    const tierRanks = [...new Set(state.groups.flat().map((skin) => skin.tierRank))];

    for (const tierRank of tierRanks) {
      const counts = state.groups.map(
        (group) => group.filter((skin) => skin.tierRank === tierRank).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });
});

describe('selection validation', () => {
  it('rejects invalid, duplicate, over-capacity, and wrong-count group picks', () => {
    const initial = createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'groups');
    const currentIds = initial.groups[0].map((skin) => skin.id);
    const nextGroupId = initial.groups[1][0].id;

    expect(() => toggleGroupPick(initial, nextGroupId)).toThrow(/current group/i);

    let selected = toggleGroupPick(initial, currentIds[0]);
    selected = toggleGroupPick(selected, currentIds[1]);
    expect(() => toggleGroupPick(selected, currentIds[2])).toThrow(/exactly 2/i);
    expect(toggleGroupPick(selected, currentIds[1]).groupPicks).toEqual([currentIds[0]]);

    expect(() => confirmGroupPick(initial, [currentIds[0]])).toThrow(/exactly 2/i);
    expect(() => confirmGroupPick(initial, [currentIds[0], currentIds[0]])).toThrow(
      /duplicate/i,
    );
    expect(() => confirmGroupPick(initial, [currentIds[0], nextGroupId])).toThrow(
      /current group/i,
    );
  });

  it('rejects wildcard picks with the wrong count, duplicates, or non-losers', () => {
    const grouped = finishAllGroups(
      createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'wildcards'),
    );
    const loserIds = grouped.losers.map((skin) => skin.id);

    expect(() => confirmWildcards(grouped, loserIds.slice(0, 3))).toThrow(/exactly 4/i);
    expect(() =>
      confirmWildcards(grouped, [loserIds[0], loserIds[1], loserIds[2], loserIds[2]]),
    ).toThrow(/duplicate/i);
    expect(() =>
      confirmWildcards(grouped, [
        loserIds[0],
        loserIds[1],
        loserIds[2],
        grouped.qualifiers[0].id,
      ]),
    ).toThrow(/loser/i);
  });
});

describe('knockout progression', () => {
  it('plays every duel, builds each round, and exposes the champion', () => {
    let state = startKnockout(
      createTournament(skinsFor('vandal'), weaponConfigs.vandal, 'knockout'),
    );
    let duelCount = 0;

    while (state.phase === 'knockout') {
      const match = state.bracket[state.roundIndex][state.matchIndex];
      state = chooseWinner(state, match.skins[0].id);
      duelCount += 1;
    }

    expect(state.phase).toBe('complete');
    expect(state.champion).toBeDefined();
    expect(state.runnerUp).toBeDefined();
    expect(state.champion?.id).not.toBe(state.runnerUp?.id);
    expect(duelCount).toBe(31);
    expect(state.bracket.map((round) => round.length)).toEqual([16, 8, 4, 2, 1]);
    expect(state.bracket.flat().every((match) => match.winner !== null)).toBe(true);
    expect(() => chooseWinner(state, state.champion!.id)).toThrow(/knockout/i);
  });

  it('rejects a skin that is not in the current duel', () => {
    const state = startKnockout(
      createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'duel-validation'),
    );
    const currentIds = new Set(state.bracket[0][0].skins.map((skin) => skin.id));
    const invalid = state.qualifiers.find((skin) => !currentIds.has(skin.id));

    expect(invalid).toBeDefined();
    expect(() => chooseWinner(state, invalid!.id)).toThrow(/current match/i);
  });

  it('reports strictly monotonic progress for every confirmed action', () => {
    let state = createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'progress');
    const values = [progress(state)];

    while (state.phase === 'groups') {
      state = confirmGroupPick(
        state,
        state.groups[state.groupIndex]
          .slice(0, state.config.picksPerGroup)
          .map((skin) => skin.id),
      );
      values.push(progress(state));
    }

    state = confirmWildcards(
      state,
      state.losers.slice(0, state.config.wildcardSlots).map((skin) => skin.id),
    );
    values.push(progress(state));

    while (state.phase === 'knockout') {
      const match = state.bracket[state.roundIndex][state.matchIndex];
      state = chooseWinner(state, match.skins[0].id);
      values.push(progress(state));
    }

    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expect(values.every((value, index) => index === 0 || value > values[index - 1])).toBe(
      true,
    );
  });
});

describe('history and fresh starts', () => {
  it('undoes confirmed group, wildcard, and duel actions one snapshot at a time', () => {
    const initial = createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'undo');
    const firstPickIds = initial.groups[0].slice(0, 2).map((skin) => skin.id);
    const afterGroup = confirmGroupPick(initial, firstPickIds);
    const undoneGroup = undo(afterGroup);

    expect(undoneGroup).toMatchObject({ phase: 'groups', groupIndex: 0, qualifiers: [] });
    expect(undoneGroup.history).toHaveLength(0);

    const grouped = finishAllGroups(initial);
    const wildcardIds = grouped.losers.slice(0, 4).map((skin) => skin.id);
    const knockout = confirmWildcards(grouped, wildcardIds);
    const undoneWildcards = undo(knockout);

    expect(undoneWildcards.phase).toBe('revival');
    expect(undoneWildcards.wildcardPicks).toEqual([]);
    expect(undoneWildcards.bracket).toEqual([]);

    const match = knockout.bracket[0][0];
    const afterDuel = chooseWinner(knockout, match.skins[0].id);
    const undoneDuel = undo(afterDuel);

    expect(undoneDuel.phase).toBe('knockout');
    expect(undoneDuel.roundIndex).toBe(0);
    expect(undoneDuel.matchIndex).toBe(0);
    expect(undoneDuel.bracket[0][0].winner).toBeNull();
  });

  it('restores each exact prior state across repeated undo operations', () => {
    const initial = createTournament(skinsFor('sheriff'), weaponConfigs.sheriff, 'repeat-undo');
    const afterFirst = confirmGroupPick(
      initial,
      initial.groups[0].slice(0, 2).map((skin) => skin.id),
    );
    const afterSecond = confirmGroupPick(
      afterFirst,
      afterFirst.groups[1].slice(0, 2).map((skin) => skin.id),
    );
    const restored = JSON.parse(JSON.stringify(afterSecond)) as TournamentState;

    expect(undo(afterSecond)).toEqual(afterFirst);
    expect(undo(undo(afterSecond))).toEqual(initial);
    expect(undo(restored)).toEqual(JSON.parse(JSON.stringify(afterFirst)));
  });

  it('restart clears progress and history while preserving the complete entrant pool', () => {
    const initial = createTournament(skinsFor('phantom'), weaponConfigs.phantom, 'original');
    const progressed = confirmGroupPick(
      initial,
      initial.groups[0].slice(0, 2).map((skin) => skin.id),
    );
    const fresh = restart(progressed, 'fresh-seed');

    expect(fresh.phase).toBe('groups');
    expect(fresh.groupIndex).toBe(0);
    expect(fresh.qualifiers).toEqual([]);
    expect(fresh.losers).toEqual([]);
    expect(fresh.history).toEqual([]);
    expect(progress(fresh)).toBe(0);
    expect(groupIds(fresh)).not.toEqual(groupIds(initial));
    expect(new Set(fresh.groups.flat().map((skin) => skin.id))).toEqual(
      new Set(initial.groups.flat().map((skin) => skin.id)),
    );
  });

  it('keeps a completed Vandal tournament safely below a 1 MiB UTF-16 payload', () => {
    let state = startKnockout(
      createTournament(skinsFor('vandal'), weaponConfigs.vandal, 'storage-quota'),
    );

    while (state.phase === 'knockout') {
      const match = state.bracket[state.roundIndex][state.matchIndex];
      state = chooseWinner(state, match.skins[0].id);
    }

    const utf16Bytes = JSON.stringify(state).length * 2;
    expect(utf16Bytes).toBeLessThan(1024 * 1024);
  });
});

it('rejects a malformed entrant pool before creating a tournament', () => {
  const skins = skinsFor('vandal');

  expect(() =>
    createTournament([...skins.slice(0, -1), skins[0]], weaponConfigs.vandal, 'duplicate'),
  ).toThrow(/duplicate/i);
  expect(() =>
    createTournament(skins.slice(0, -1), weaponConfigs.vandal, 'wrong-count'),
  ).toThrow(/exactly 42/i);
  expect(() =>
    createTournament(
      [...skins.slice(0, -1), skinsFor('phantom')[0]],
      weaponConfigs.vandal as WeaponConfig,
      'mixed-weapons',
    ),
  ).toThrow(/same weapon/i);
});

it('rejects a config that requests more wildcards than available losers', () => {
  const impossibleConfig: WeaponConfig = {
    label: weaponConfigs.sheriff.label,
    expectedCount: 4,
    groupSizes: [2, 2],
    picksPerGroup: 2,
    wildcardSlots: 4,
    bracketSize: 8,
  };

  expect(() => createTournament(skinsFor('sheriff').slice(0, 4), impossibleConfig, 'stuck')).toThrow(
    /wildcard slots.*losers/i,
  );
});

it('rejects non-integer tournament counts', () => {
  const fractionalConfig: WeaponConfig = {
    label: weaponConfigs.sheriff.label,
    expectedCount: 4,
    groupSizes: [2, 2],
    picksPerGroup: 1.5,
    wildcardSlots: 1,
    bracketSize: 4,
  };

  expect(() =>
    createTournament(skinsFor('sheriff').slice(0, 4), fractionalConfig, 'fractional'),
  ).toThrow(/positive integers/i);
});
