import { weaponConfigs } from '../src/domain/catalog';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import { confirmGroupPick, createTournament } from '../src/domain/tournament';
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
