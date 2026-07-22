import type {
  Skin,
  TournamentMatch,
  TournamentPhase,
  TournamentSnapshot,
  TournamentState,
  WeaponConfig,
} from './types';

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let value = hashSeed(seed);

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function assertConfig(config: WeaponConfig): void {
  const counts = [
    config.expectedCount,
    config.picksPerGroup,
    config.wildcardSlots,
    config.bracketSize,
    ...config.groupSizes,
  ];

  if (
    config.groupSizes.length === 0 ||
    counts.some((count) => !Number.isInteger(count) || count <= 0)
  ) {
    throw new Error('Tournament counts must be positive integers');
  }

  const groupCapacity = config.groupSizes.reduce((total, size) => total + size, 0);
  const groupQualifiers = config.groupSizes.length * config.picksPerGroup;

  if (groupCapacity !== config.expectedCount) {
    throw new Error('Group capacities must equal the configured entrant count');
  }

  if (config.groupSizes.some((size) => size < config.picksPerGroup)) {
    throw new Error('Every group must have enough skins for its configured picks');
  }

  if (groupQualifiers + config.wildcardSlots !== config.bracketSize) {
    throw new Error('Group picks and wildcard slots must fill the bracket');
  }

  if (config.wildcardSlots > config.expectedCount - groupQualifiers) {
    throw new Error('Wildcard slots cannot exceed the available group-stage losers');
  }

  if (config.bracketSize < 2 || (config.bracketSize & (config.bracketSize - 1)) !== 0) {
    throw new Error('Bracket size must be a power of two');
  }
}

function assertEntrants(skins: readonly Skin[], config: WeaponConfig): void {
  if (skins.length !== config.expectedCount) {
    throw new Error(`Tournament requires exactly ${config.expectedCount} skins`);
  }

  if (new Set(skins.map((skin) => skin.id)).size !== skins.length) {
    throw new Error('Tournament entrants contain duplicate skin IDs');
  }

  const weapon = skins[0]?.weapon;
  if (!weapon || skins.some((skin) => skin.weapon !== weapon)) {
    throw new Error('Tournament entrants must all use the same weapon');
  }
}

function nextSnakeCandidate(
  candidates: ReadonlySet<number>,
  cursor: { index: number; direction: 1 | -1 },
  groupCount: number,
): number {
  while (!candidates.has(cursor.index)) {
    advanceSnake(cursor, groupCount);
  }

  const selected = cursor.index;
  advanceSnake(cursor, groupCount);
  return selected;
}

function advanceSnake(
  cursor: { index: number; direction: 1 | -1 },
  groupCount: number,
): void {
  if (groupCount === 1) {
    return;
  }

  let next = cursor.index + cursor.direction;
  if (next < 0 || next >= groupCount) {
    cursor.direction = cursor.direction === 1 ? -1 : 1;
    next = cursor.index + cursor.direction;
  }
  cursor.index = next;
}

function balancedGroups(
  skins: readonly Skin[],
  groupSizes: readonly number[],
  seed: string,
): Skin[][] {
  const groups = groupSizes.map(() => [] as Skin[]);
  const tierBuckets = new Map<number, Skin[]>();

  for (const skin of skins) {
    const bucket = tierBuckets.get(skin.tierRank) ?? [];
    bucket.push(skin);
    tierBuckets.set(skin.tierRank, bucket);
  }

  const tiers = [...tierBuckets.keys()].sort((left, right) => right - left);

  tiers.forEach((tierRank, bucketIndex) => {
    const bucket = shuffled(
      tierBuckets.get(tierRank) ?? [],
      seededRandom(`${seed}:tier:${tierRank}`),
    );
    const startsForward = bucketIndex % 2 === 0;
    const cursor: { index: number; direction: 1 | -1 } = {
      index: startsForward ? 0 : groups.length - 1,
      direction: startsForward ? 1 : -1,
    };

    for (const skin of bucket) {
      const available = groups
        .map((group, index) => ({ group, index }))
        .filter(({ group, index }) => group.length < groupSizes[index]);
      const minimumTierCount = Math.min(
        ...available.map(
          ({ group }) => group.filter((candidate) => candidate.tierRank === tierRank).length,
        ),
      );
      const tierBalanced = available.filter(
        ({ group }) =>
          group.filter((candidate) => candidate.tierRank === tierRank).length ===
          minimumTierCount,
      );
      const minimumOccupancy = Math.min(...tierBalanced.map(({ group }) => group.length));
      const candidates = new Set(
        tierBalanced
          .filter(({ group }) => group.length === minimumOccupancy)
          .map(({ index }) => index),
      );
      const groupIndex = nextSnakeCandidate(candidates, cursor, groups.length);
      groups[groupIndex].push(skin);
    }
  });

  if (groups.some((group, index) => group.length !== groupSizes[index])) {
    throw new Error('Unable to fill every configured group capacity');
  }

  return groups;
}

function withoutHistory(state: TournamentState): TournamentSnapshot {
  const { history: _history, ...snapshot } = state;
  return snapshot;
}

function withSnapshot(state: TournamentState): readonly TournamentSnapshot[] {
  return [...state.history, withoutHistory(state)];
}

function assertPhase(state: TournamentState, expected: TournamentPhase): void {
  if (state.phase !== expected) {
    throw new Error(`Action requires the ${expected} phase`);
  }
}

function validateSelection(
  selectedIds: readonly string[],
  validSkins: readonly Skin[],
  requiredCount: number,
  validLabel: string,
): void {
  if (selectedIds.length !== requiredCount) {
    throw new Error(`Select exactly ${requiredCount} skins`);
  }

  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error('Selection contains duplicate skin IDs');
  }

  const validIds = new Set(validSkins.map((skin) => skin.id));
  if (selectedIds.some((id) => !validIds.has(id))) {
    throw new Error(`Every selected skin must be a ${validLabel}`);
  }
}

function createMatches(skins: readonly Skin[]): TournamentMatch[] {
  if (skins.length % 2 !== 0) {
    throw new Error('A knockout round requires an even number of skins');
  }

  const matches: TournamentMatch[] = [];
  for (let index = 0; index < skins.length; index += 2) {
    matches.push({
      skins: [skins[index], skins[index + 1]],
      winner: null,
    });
  }
  return matches;
}

function buildTournament(
  skins: readonly Skin[],
  config: WeaponConfig,
  seed: string,
  restartCount: number,
): TournamentState {
  assertConfig(config);
  assertEntrants(skins, config);

  return {
    weapon: skins[0].weapon,
    config,
    seed,
    restartCount,
    entrants: [...skins],
    phase: 'groups',
    groups: balancedGroups(skins, config.groupSizes, seed),
    groupIndex: 0,
    groupPicks: [],
    qualifiers: [],
    losers: [],
    wildcardPicks: [],
    bracket: [],
    roundIndex: 0,
    matchIndex: 0,
    champion: null,
    runnerUp: null,
    history: [],
  };
}

export function createTournament(
  skins: readonly Skin[],
  config: WeaponConfig,
  seed: string,
): TournamentState {
  return buildTournament(skins, config, seed, 0);
}

export function toggleGroupPick(state: TournamentState, skinId: string): TournamentState {
  assertPhase(state, 'groups');
  const currentGroup = state.groups[state.groupIndex];

  if (!currentGroup.some((skin) => skin.id === skinId)) {
    throw new Error('Selected skin is not in the current group');
  }

  if (state.groupPicks.includes(skinId)) {
    return {
      ...state,
      groupPicks: state.groupPicks.filter((id) => id !== skinId),
    };
  }

  if (state.groupPicks.length >= state.config.picksPerGroup) {
    throw new Error(`Select exactly ${state.config.picksPerGroup} skins in this group`);
  }

  return {
    ...state,
    groupPicks: [...state.groupPicks, skinId],
  };
}

export function confirmGroupPick(
  state: TournamentState,
  selectedIds: readonly string[] = state.groupPicks,
): TournamentState {
  assertPhase(state, 'groups');
  const currentGroup = state.groups[state.groupIndex];
  validateSelection(
    selectedIds,
    currentGroup,
    state.config.picksPerGroup,
    'member of the current group',
  );

  const selected = new Set(selectedIds);
  const qualifiers = currentGroup.filter((skin) => selected.has(skin.id));
  const losers = currentGroup.filter((skin) => !selected.has(skin.id));
  const nextGroupIndex = state.groupIndex + 1;

  return {
    ...state,
    phase: nextGroupIndex === state.groups.length ? 'revival' : 'groups',
    groupIndex: nextGroupIndex,
    groupPicks: [],
    qualifiers: [...state.qualifiers, ...qualifiers],
    losers: [...state.losers, ...losers],
    history: withSnapshot(state),
  };
}

export function confirmWildcards(
  state: TournamentState,
  selectedIds: readonly string[],
): TournamentState {
  assertPhase(state, 'revival');
  validateSelection(selectedIds, state.losers, state.config.wildcardSlots, 'group-stage loser');

  const selected = new Set(selectedIds);
  const wildcards = state.losers.filter((skin) => selected.has(skin.id));
  const qualifiers = [...state.qualifiers, ...wildcards];

  if (qualifiers.length !== state.config.bracketSize) {
    throw new Error('Wildcard picks did not fill the configured bracket');
  }

  const bracketEntrants = shuffled(qualifiers, seededRandom(`${state.seed}:bracket`));

  return {
    ...state,
    phase: 'knockout',
    wildcardPicks: [...selectedIds],
    qualifiers,
    bracket: [createMatches(bracketEntrants)],
    roundIndex: 0,
    matchIndex: 0,
    history: withSnapshot(state),
  };
}

export function chooseWinner(state: TournamentState, skinId: string): TournamentState {
  assertPhase(state, 'knockout');
  const currentRound = state.bracket[state.roundIndex];
  const currentMatch = currentRound?.[state.matchIndex];

  if (!currentMatch) {
    throw new Error('There is no current knockout match');
  }

  const winner = currentMatch.skins.find((skin) => skin.id === skinId);
  if (!winner) {
    throw new Error('Winner must be present in the current match');
  }

  const runnerUp = currentMatch.skins.find((skin) => skin.id !== skinId) ?? null;
  const completedRound = currentRound.map((match, index) =>
    index === state.matchIndex ? { ...match, winner } : match,
  );
  const bracket = state.bracket.map((round, index) =>
    index === state.roundIndex ? completedRound : round,
  );
  const history = withSnapshot(state);

  if (state.matchIndex + 1 < completedRound.length) {
    return {
      ...state,
      bracket,
      matchIndex: state.matchIndex + 1,
      history,
    };
  }

  const winners = completedRound.map((match) => match.winner);
  if (winners.some((skin) => skin === null)) {
    throw new Error('Every match in the round must have a winner');
  }

  const advancing = winners as Skin[];
  if (advancing.length === 1) {
    return {
      ...state,
      phase: 'complete',
      bracket,
      champion: winner,
      runnerUp,
      history,
    };
  }

  return {
    ...state,
    bracket: [...bracket, createMatches(advancing)],
    roundIndex: state.roundIndex + 1,
    matchIndex: 0,
    history,
  };
}

export function undo(state: TournamentState): TournamentState {
  const snapshot = state.history.at(-1);
  if (!snapshot) {
    return state;
  }

  return {
    ...snapshot,
    history: state.history.slice(0, -1),
  };
}

export function restart(state: TournamentState, seed?: string): TournamentState {
  const restartCount = state.restartCount + 1;
  const nextSeed = seed ?? `${state.seed}:restart:${restartCount}`;
  return buildTournament(state.entrants, state.config, nextSeed, restartCount);
}

export function progress(state: TournamentState): number {
  const totalActions = state.groups.length + 1 + (state.config.bracketSize - 1);
  const completedGroups = Math.min(state.groupIndex, state.groups.length);
  const completedWildcards =
    state.phase === 'knockout' || state.phase === 'complete' ? 1 : 0;
  const completedDuels = state.bracket
    .flat()
    .filter((match) => match.winner !== null).length;

  return (completedGroups + completedWildcards + completedDuels) / totalActions;
}
