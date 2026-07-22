import { weaponConfigs } from '../src/domain/catalog';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
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
