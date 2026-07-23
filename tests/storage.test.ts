import { weaponConfigs } from '../src/domain/catalog';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
  toggleGroupPick,
} from '../src/domain/tournament';
import type { TournamentState } from '../src/domain/types';
import {
  STORAGE_KEY,
  clearTournament,
  loadTournament,
  saveTournament,
} from '../src/lib/storage';

function vandalState(): TournamentState {
  return createTournament(
    skinCatalog.filter((skin) => skin.weapon === 'vandal'),
    weaponConfigs.vandal,
    'storage-test',
  );
}

function finishGroups(state: TournamentState): TournamentState {
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

function sheriffKnockout(): TournamentState {
  const initial = createTournament(
    skinCatalog.filter((skin) => skin.weapon === 'sheriff'),
    weaponConfigs.sheriff,
    'storage-knockout',
  );
  const grouped = finishGroups(initial);
  return confirmWildcards(
    grouped,
    grouped.losers.slice(0, grouped.config.wildcardSlots).map((skin) => skin.id),
  );
}

function completedSheriff(): TournamentState {
  let state = sheriffKnockout();
  while (state.phase === 'knockout') {
    state = chooseWinner(
      state,
      state.bracket[state.roundIndex][state.matchIndex].skins[0].id,
    );
  }
  return state;
}

function sheriffSecondRound(): TournamentState {
  let state = sheriffKnockout();
  while (state.phase === 'knockout' && state.roundIndex === 0) {
    state = chooseWinner(
      state,
      state.bracket[state.roundIndex][state.matchIndex].skins[0].id,
    );
  }
  return state;
}

function confirmNextGroup(state: TournamentState, offset = 0): TournamentState {
  const group = state.groups[state.groupIndex];
  const selected = Array.from(
    { length: state.config.picksPerGroup },
    (_value, index) => group[(index + offset) % group.length].id,
  );
  return confirmGroupPick(state, selected);
}

function afterThreeVandalGroups(): TournamentState {
  return confirmNextGroup(confirmNextGroup(confirmNextGroup(vandalState())));
}

function expectStoredStateRejected(state: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state }));
  expect(loadTournament()).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('round-trips a tournament with the current schema version', () => {
  const initial = vandalState();
  const state = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, initial.config.picksPerGroup).map((skin) => skin.id),
  );

  expect(saveTournament(state)).toBe(true);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: 1, state });
  expect(loadTournament()).toEqual(state);
  expect(loadTournament()?.history).toHaveLength(1);
});

it.each([
  ['invalid JSON', '{not-json'],
  ['the wrong version', JSON.stringify({ version: 0, state: vandalState() })],
  ['a malformed state', JSON.stringify({ version: 1, state: { weapon: 'vandal' } })],
])('discards %s', (_label, payload) => {
  localStorage.setItem(STORAGE_KEY, payload);

  expect(loadTournament()).toBeNull();
});

it('discards state whose catalog IDs or config are stale', () => {
  const state = vandalState();
  const staleCatalogState = {
    ...state,
    entrants: [{ ...state.entrants[0], id: 'removed-from-catalog' }, ...state.entrants.slice(1)],
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, state: staleCatalogState }),
  );
  expect(loadTournament()).toBeNull();

  const staleConfigState = {
    ...state,
    config: { ...state.config, wildcardSlots: state.config.wildcardSlots + 1 },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: staleConfigState }));
  expect(loadTournament()).toBeNull();
});

it('discards malformed compact history before undo can restore it', () => {
  const initial = vandalState();
  const progressed = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, initial.config.picksPerGroup).map((skin) => skin.id),
  );
  const malformed = {
    ...progressed,
    history: [{ ...progressed.history[0], groupIndex: 999 }],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));

  expect(loadTournament()).toBeNull();
});

it.each([
  ['groups', () => {
    const initial = vandalState();
    return confirmGroupPick(
      initial,
      initial.groups[0].slice(0, 2).map((skin) => skin.id),
    );
  }],
  ['revival', sheriffKnockout],
] as const)(
  'rejects nonzero round and match indices in %s compact history',
  (_phase, makeState) => {
    const state = makeState();
    const snapshotIndex = state.history.length - 1;

    for (const field of ['roundIndex', 'matchIndex'] as const) {
      const malformed = {
        ...state,
        history: state.history.map((snapshot, index) =>
          index === snapshotIndex ? { ...snapshot, [field]: 1 } : snapshot,
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));
      expect(loadTournament()).toBeNull();
    }
  },
);

it.each([
  ['an earlier round', { roundIndex: 0 }],
  ['an out-of-range match', { matchIndex: 999 }],
])('rejects completed state positioned at %s', (_label, indices) => {
  const complete = completedSheriff();
  const malformed = { ...complete, ...indices };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));

  expect(loadTournament()).toBeNull();
});

it('restores a completed state at the final bracket position', () => {
  const complete = completedSheriff();

  expect(saveTournament(complete)).toBe(true);
  expect(loadTournament()).toEqual(complete);
});

it.each([
  ['groups', vandalState],
  ['revival', () => finishGroups(vandalState())],
] as const)(
  'rejects nonzero round and match indices in current %s state',
  (_phase, makeState) => {
    const state = makeState();

    for (const field of ['roundIndex', 'matchIndex'] as const) {
      for (const invalidIndex of [1, 999]) {
        const malformed = { ...state, [field]: invalidIndex };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));
        expect(loadTournament()).toBeNull();
      }
    }
  },
);

it('rejects a current knockout index outside the latest unresolved position', () => {
  const secondRound = sheriffSecondRound();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, state: { ...secondRound, roundIndex: 0, matchIndex: 0 } }),
  );
  expect(loadTournament()).toBeNull();

  const afterOneMatch = chooseWinner(
    secondRound,
    secondRound.bracket[secondRound.roundIndex][secondRound.matchIndex].skins[0].id,
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, state: { ...afterOneMatch, matchIndex: 0 } }),
  );
  expect(loadTournament()).toBeNull();
});

it('rejects compact knockout history that points outside its latest round', () => {
  const secondRound = sheriffSecondRound();
  const afterOneMatch = chooseWinner(
    secondRound,
    secondRound.bracket[secondRound.roundIndex][secondRound.matchIndex].skins[0].id,
  );
  const snapshotIndex = afterOneMatch.history.length - 1;
  const malformed = {
    ...afterOneMatch,
    history: afterOneMatch.history.map((snapshot, index) =>
      index === snapshotIndex ? { ...snapshot, roundIndex: 0, matchIndex: 0 } : snapshot,
    ),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));

  expect(loadTournament()).toBeNull();
});

it('rejects unreachable complete-phase compact history', () => {
  const state = sheriffSecondRound();
  const snapshotIndex = state.history.length - 1;
  const malformed = {
    ...state,
    history: state.history.map((snapshot, index) =>
      index === snapshotIndex
        ? {
            ...snapshot,
            phase: 'complete' as const,
            championId: state.entrants[0].id,
            runnerUpId: state.entrants[1].id,
          }
        : snapshot,
    ),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: malformed }));

  expect(loadTournament()).toBeNull();
});

it('rejects duplicate, overlapping, or incomplete completed-group partitions', () => {
  const initial = vandalState();
  const progressed = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, initial.config.picksPerGroup).map((skin) => skin.id),
  );

  expectStoredStateRejected({
    ...progressed,
    qualifiers: [progressed.qualifiers[0], progressed.qualifiers[0]],
  });
  expectStoredStateRejected({
    ...progressed,
    losers: [progressed.qualifiers[0]],
  });
  expectStoredStateRejected({
    ...progressed,
    losers: [],
  });
});

it('rejects duplicate, non-loser, or wrong-count revival wildcard picks', () => {
  const revival = finishGroups(vandalState());
  const loserIds = revival.losers.map((skin) => skin.id);

  for (const wildcardPicks of [
    [loserIds[0], loserIds[0], loserIds[1], loserIds[2]],
    [loserIds[0], loserIds[1], loserIds[2], revival.qualifiers[0].id],
    [loserIds[0]],
  ]) {
    expectStoredStateRejected({ ...revival, wildcardPicks });
  }
});

it('rejects duplicate or mismatched knockout qualifiers and first-round entrants', () => {
  const knockout = sheriffKnockout();
  expectStoredStateRejected({
    ...knockout,
    qualifiers: [knockout.qualifiers[0], knockout.qualifiers[0], ...knockout.qualifiers.slice(2)],
  });

  const duplicate = knockout.bracket[0][1].skins[0];
  const malformedFirstRound = knockout.bracket[0].map((match, index) =>
    index === 0 ? { ...match, skins: [duplicate, match.skins[1]] } : match,
  );
  expectStoredStateRejected({
    ...knockout,
    bracket: [malformedFirstRound],
  });
});

it('rejects later bracket rounds not derived from prior winners', () => {
  const secondRound = sheriffSecondRound();
  const priorLoser = secondRound.bracket[0][0].skins.find(
    (skin) => skin.id !== secondRound.bracket[0][0].winner?.id,
  )!;
  const malformedSecondRound = secondRound.bracket[1].map((match, index) =>
    index === 0 ? { ...match, skins: [priorLoser, match.skins[1]] } : match,
  );
  expectStoredStateRejected({
    ...secondRound,
    bracket: [secondRound.bracket[0], malformedSecondRound],
  });

  const changedWinner = {
    ...secondRound.bracket[0][0],
    winner: priorLoser,
  };
  const malformedPriorRound = secondRound.bracket[0].map((match, index) =>
    index === 0 ? changedWinner : match,
  );
  expectStoredStateRejected({
    ...secondRound,
    bracket: [malformedPriorRound, secondRound.bracket[1]],
  });
});

it('rejects unreachable completed-group partitions in compact history', () => {
  const initial = vandalState();
  const afterFirst = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, initial.config.picksPerGroup).map((skin) => skin.id),
  );
  const afterSecond = confirmGroupPick(
    afterFirst,
    afterFirst.groups[1].slice(0, afterFirst.config.picksPerGroup).map((skin) => skin.id),
  );
  const snapshotIndex = afterSecond.history.length - 1;
  const malformed = {
    ...afterSecond,
    history: afterSecond.history.map((snapshot, index) =>
      index === snapshotIndex
        ? {
            ...snapshot,
            qualifierIds: [snapshot.qualifierIds[0], snapshot.qualifierIds[0]],
          }
        : snapshot,
    ),
  };

  expectStoredStateRejected(malformed);
});

it('rejects unreachable revival and knockout provenance in compact history', () => {
  const knockout = sheriffKnockout();
  const revivalSnapshotIndex = knockout.history.length - 1;
  const revivalSnapshot = knockout.history[revivalSnapshotIndex];
  expectStoredStateRejected({
    ...knockout,
    history: knockout.history.map((snapshot, index) =>
      index === revivalSnapshotIndex
        ? {
            ...snapshot,
            wildcardPicks: [
              revivalSnapshot.loserIds[0],
              revivalSnapshot.loserIds[0],
              revivalSnapshot.loserIds[1],
              revivalSnapshot.loserIds[2],
            ],
          }
        : snapshot,
    ),
  });

  const secondRound = sheriffSecondRound();
  const afterOneMatch = chooseWinner(
    secondRound,
    secondRound.bracket[secondRound.roundIndex][secondRound.matchIndex].skins[0].id,
  );
  const knockoutSnapshotIndex = afterOneMatch.history.length - 1;
  const knockoutSnapshot = afterOneMatch.history[knockoutSnapshotIndex];
  const priorLoserId = knockoutSnapshot.bracket[0][0].skinIds.find(
    (id) => id !== knockoutSnapshot.bracket[0][0].winnerId,
  )!;
  expectStoredStateRejected({
    ...afterOneMatch,
    history: afterOneMatch.history.map((snapshot, index) =>
      index === knockoutSnapshotIndex
        ? {
            ...snapshot,
            bracket: snapshot.bracket.map((round, roundIndex) =>
              roundIndex === 1
                ? round.map((match, matchIndex) =>
                    matchIndex === 0
                      ? { ...match, skinIds: [priorLoserId, match.skinIds[1]] }
                      : match,
                  )
                : round,
            ),
          }
        : snapshot,
    ),
  });
});

it('rejects compact history snapshots in the wrong order', () => {
  const state = afterThreeVandalGroups();

  expectStoredStateRejected({
    ...state,
    history: [state.history[0], state.history[2], state.history[1]],
  });
});

it('rejects a duplicated compact history snapshot', () => {
  const state = afterThreeVandalGroups();

  expectStoredStateRejected({
    ...state,
    history: [state.history[0], state.history[1], state.history[1], state.history[2]],
  });
});

it('rejects a missing compact history snapshot', () => {
  const state = afterThreeVandalGroups();

  expectStoredStateRejected({
    ...state,
    history: [state.history[0], state.history[2]],
  });
});

it('rejects compact history spliced from a different valid branch', () => {
  const branchAAfterFirst = confirmNextGroup(vandalState());
  const branchA = confirmNextGroup(branchAAfterFirst);
  const branchBAfterFirst = confirmNextGroup(vandalState(), 1);
  const branchB = confirmNextGroup(branchBAfterFirst);

  expectStoredStateRejected({
    ...branchA,
    history: [branchA.history[0], branchB.history[1]],
  });
});

it('rejects tampered non-empty group picks in compact history', () => {
  const initial = vandalState();
  const group = initial.groups[initial.groupIndex];
  const selectedIds = group
    .slice(0, initial.config.picksPerGroup)
    .map((skin) => skin.id);
  const selected = selectedIds.reduce(toggleGroupPick, initial);
  const confirmed = confirmGroupPick(selected);
  const alternateIds = group
    .slice(-initial.config.picksPerGroup)
    .map((skin) => skin.id);

  expect(confirmed.history[0].groupPicks).toEqual(selectedIds);
  expect(saveTournament(confirmed)).toBe(true);
  expect(loadTournament()).toEqual(confirmed);
  expectStoredStateRejected({
    ...confirmed,
    history: [{ ...confirmed.history[0], groupPicks: alternateIds }],
  });
});

it('swallows storage quota and security errors so gameplay can continue', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  });
  expect(() => saveTournament(vandalState())).not.toThrow();
  expect(saveTournament(vandalState())).toBe(false);

  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });
  expect(loadTournament()).toBeNull();

  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });
  expect(() => clearTournament()).not.toThrow();
});
