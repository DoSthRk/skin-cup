import { weaponConfigs } from '../domain/catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
} from '../domain/tournament';
import type {
  Skin,
  TournamentMatchSnapshot,
  TournamentPhase,
  TournamentSnapshot,
  TournamentState,
  WeaponConfig,
  WeaponId,
} from '../domain/types';
import { skinCatalog } from '../data/generated-skin-catalog';

export const STORAGE_KEY = 'skin-cup:v1';
const STORAGE_VERSION = 1;
const phases = new Set(['groups', 'revival', 'knockout', 'complete']);
const weapons = new Set<WeaponId>(['vandal', 'phantom', 'sheriff', 'melee']);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCurrentSkin(value: unknown, currentById: ReadonlyMap<string, Skin>): value is Skin {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false;
  }

  const current = currentById.get(value.id);
  return current !== undefined && sameJson(value, current);
}

function isSkinArray(
  value: unknown,
  currentById: ReadonlyMap<string, Skin>,
): value is Skin[] {
  return Array.isArray(value) && value.every((skin) => isCurrentSkin(skin, currentById));
}

interface PhasePartition {
  readonly phase: TournamentPhase;
  readonly groupIndex: number;
  readonly groupPicks: readonly string[];
  readonly qualifierIds: readonly string[];
  readonly loserIds: readonly string[];
  readonly wildcardPicks: readonly string[];
}

interface BracketReference {
  readonly skinIds: readonly [string, string];
  readonly winnerId: string | null;
}

function hasUniqueIds(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

function hasSameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightIds = new Set(right);
  return hasUniqueIds(left) && hasUniqueIds(right) && left.every((id) => rightIds.has(id));
}

function isReachablePartition(
  partition: PhasePartition,
  groups: readonly (readonly Skin[])[],
  config: WeaponConfig,
): boolean {
  const {
    phase,
    groupIndex,
    groupPicks,
    qualifierIds,
    loserIds,
    wildcardPicks,
  } = partition;

  if (
    !hasUniqueIds(groupPicks) ||
    !hasUniqueIds(qualifierIds) ||
    !hasUniqueIds(loserIds) ||
    !hasUniqueIds(wildcardPicks)
  ) {
    return false;
  }

  if (phase === 'groups') {
    const currentGroupIds = new Set(groups[groupIndex]?.map((skin) => skin.id));
    if (
      groupIndex >= groups.length ||
      groupPicks.length > config.picksPerGroup ||
      groupPicks.some((id) => !currentGroupIds.has(id)) ||
      wildcardPicks.length !== 0
    ) {
      return false;
    }
  } else if (groupIndex !== groups.length || groupPicks.length !== 0) {
    return false;
  }

  const completedGroups = groups.slice(0, groupIndex);
  const completedIds = completedGroups.flatMap((group) => group.map((skin) => skin.id));
  const loserSet = new Set(loserIds);
  const wildcardSet = new Set(wildcardPicks);
  const knockoutStarted = phase === 'knockout' || phase === 'complete';

  if (knockoutStarted) {
    if (
      wildcardPicks.length !== config.wildcardSlots ||
      wildcardPicks.some((id) => !loserSet.has(id)) ||
      wildcardPicks.some((id) => !qualifierIds.includes(id)) ||
      qualifierIds.length !== config.bracketSize
    ) {
      return false;
    }
  } else if (wildcardPicks.length !== 0) {
    return false;
  }

  const baseQualifierIds = knockoutStarted
    ? qualifierIds.filter((id) => !wildcardSet.has(id))
    : qualifierIds;
  const baseQualifierSet = new Set(baseQualifierIds);
  const expectedQualifierCount = completedGroups.length * config.picksPerGroup;
  const expectedLoserCount = completedIds.length - expectedQualifierCount;

  if (
    baseQualifierIds.length !== expectedQualifierCount ||
    loserIds.length !== expectedLoserCount ||
    baseQualifierIds.some((id) => loserSet.has(id)) ||
    !hasSameIds([...baseQualifierIds, ...loserIds], completedIds)
  ) {
    return false;
  }

  if (
    knockoutStarted &&
    qualifierIds.some((id) => loserSet.has(id) !== wildcardSet.has(id))
  ) {
    return false;
  }

  return completedGroups.every((group) => {
    const ids = group.map((skin) => skin.id);
    return (
      ids.filter((id) => baseQualifierSet.has(id)).length === config.picksPerGroup &&
      ids.filter((id) => loserSet.has(id)).length === group.length - config.picksPerGroup
    );
  });
}

function isCausalBracket(
  bracket: readonly (readonly BracketReference[])[],
  qualifierIds: readonly string[],
): boolean {
  if (bracket.length === 0) {
    return false;
  }

  const firstRoundIds = bracket[0].flatMap((match) => match.skinIds);
  if (!hasSameIds(firstRoundIds, qualifierIds)) {
    return false;
  }

  for (let roundIndex = 1; roundIndex < bracket.length; roundIndex += 1) {
    const priorWinnerIds = bracket[roundIndex - 1].map((match) => match.winnerId);
    if (priorWinnerIds.some((id) => id === null)) {
      return false;
    }

    const expectedIds = priorWinnerIds as string[];
    const actualIds = bracket[roundIndex].flatMap((match) => match.skinIds);
    if (
      actualIds.length !== expectedIds.length ||
      actualIds.some((id, index) => id !== expectedIds[index])
    ) {
      return false;
    }
  }

  return true;
}

function stateBracketReferences(
  bracket: TournamentState['bracket'],
): readonly (readonly BracketReference[])[] {
  return bracket.map((round) =>
    round.map((match) => ({
      skinIds: [match.skins[0].id, match.skins[1].id],
      winnerId: match.winner?.id ?? null,
    })),
  );
}

interface TournamentCore {
  readonly phase: TournamentPhase;
  readonly groupIndex: number;
  readonly qualifierIds: readonly string[];
  readonly loserIds: readonly string[];
  readonly wildcardPicks: readonly string[];
  readonly bracket: readonly (readonly BracketReference[])[];
  readonly roundIndex: number;
  readonly matchIndex: number;
  readonly championId: string | null;
  readonly runnerUpId: string | null;
}

function snapshotCore(snapshot: TournamentSnapshot): TournamentCore {
  return {
    phase: snapshot.phase,
    groupIndex: snapshot.groupIndex,
    qualifierIds: snapshot.qualifierIds,
    loserIds: snapshot.loserIds,
    wildcardPicks: snapshot.wildcardPicks,
    bracket: snapshot.bracket,
    roundIndex: snapshot.roundIndex,
    matchIndex: snapshot.matchIndex,
    championId: snapshot.championId,
    runnerUpId: snapshot.runnerUpId,
  };
}

function stateCore(state: TournamentState): TournamentCore {
  return {
    phase: state.phase,
    groupIndex: state.groupIndex,
    qualifierIds: state.qualifiers.map((skin) => skin.id),
    loserIds: state.losers.map((skin) => skin.id),
    wildcardPicks: state.wildcardPicks,
    bracket: stateBracketReferences(state.bracket),
    roundIndex: state.roundIndex,
    matchIndex: state.matchIndex,
    championId: state.champion?.id ?? null,
    runnerUpId: state.runnerUp?.id ?? null,
  };
}

function advanceToward(
  state: TournamentState,
  target: TournamentCore,
  persistedGroupPicks: readonly string[],
): TournamentState | null {
  try {
    let advanced: TournamentState;

    if (state.phase === 'groups') {
      const currentGroupIds = new Set(
        state.groups[state.groupIndex].map((skin) => skin.id),
      );
      const existingQualifierIds = new Set(state.qualifiers.map((skin) => skin.id));
      const selectedIds = persistedGroupPicks.length > 0
        ? persistedGroupPicks
        : target.qualifierIds.filter(
            (id) => currentGroupIds.has(id) && !existingQualifierIds.has(id),
          );
      advanced = confirmGroupPick(state, selectedIds);
    } else if (state.phase === 'revival') {
      advanced = confirmWildcards(state, target.wildcardPicks);
    } else if (state.phase === 'knockout') {
      const winnerId = target.bracket[state.roundIndex]?.[state.matchIndex]?.winnerId;
      if (winnerId === null || winnerId === undefined) {
        return null;
      }
      advanced = chooseWinner(state, winnerId);
    } else {
      return null;
    }

    return { ...advanced, history: [] };
  } catch {
    return null;
  }
}

function isCausalHistory(state: TournamentState): boolean {
  try {
    let replay = createTournament(state.entrants, state.config, state.seed);
    const replayGroupIds = replay.groups.map((group) => group.map((skin) => skin.id));
    const storedGroupIds = state.groups.map((group) => group.map((skin) => skin.id));

    if (!sameJson(replayGroupIds, storedGroupIds)) {
      return false;
    }

    const snapshotCores = state.history.map(snapshotCore);
    const currentCore = stateCore(state);

    for (let index = 0; index < snapshotCores.length; index += 1) {
      if (!sameJson(stateCore(replay), snapshotCores[index])) {
        return false;
      }

      const target = snapshotCores[index + 1] ?? currentCore;
      const advanced = advanceToward(
        replay,
        target,
        state.history[index].groupPicks,
      );
      if (advanced === null) {
        return false;
      }
      replay = advanced;
    }

    return sameJson(stateCore(replay), currentCore);
  } catch {
    return false;
  }
}

function isMatchSnapshot(value: unknown, entrantIds: ReadonlySet<string>): value is TournamentMatchSnapshot {
  if (!isRecord(value) || !Array.isArray(value.skinIds) || value.skinIds.length !== 2) {
    return false;
  }

  const [left, right] = value.skinIds;
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left !== right &&
    entrantIds.has(left) &&
    entrantIds.has(right) &&
    isNullableString(value.winnerId) &&
    (value.winnerId === null || value.winnerId === left || value.winnerId === right)
  );
}

function isSnapshot(
  value: unknown,
  entrantIds: ReadonlySet<string>,
  groups: readonly (readonly Skin[])[],
  config: WeaponConfig,
): value is TournamentSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const structurallyValid = (
    typeof value.phase === 'string' &&
    phases.has(value.phase) &&
    isInteger(value.groupIndex) &&
    value.groupIndex >= 0 &&
    value.groupIndex <= groups.length &&
    isStringArray(value.groupPicks) &&
    isStringArray(value.qualifierIds) &&
    isStringArray(value.loserIds) &&
    isStringArray(value.wildcardPicks) &&
    [
      ...value.groupPicks,
      ...value.qualifierIds,
      ...value.loserIds,
      ...value.wildcardPicks,
    ].every((id) => entrantIds.has(id)) &&
    Array.isArray(value.bracket) &&
    value.bracket.every(
      (round) =>
        Array.isArray(round) && round.every((match) => isMatchSnapshot(match, entrantIds)),
    ) &&
    isInteger(value.roundIndex) &&
    value.roundIndex >= 0 &&
    isInteger(value.matchIndex) &&
    value.matchIndex >= 0 &&
    isNullableString(value.championId) &&
    isNullableString(value.runnerUpId) &&
    (value.championId === null || entrantIds.has(value.championId)) &&
    (value.runnerUpId === null || entrantIds.has(value.runnerUpId))
  );

  if (!structurallyValid) {
    return false;
  }

  const snapshot = value as unknown as TournamentSnapshot;

  if (
    !isReachablePartition(
      {
        phase: snapshot.phase,
        groupIndex: snapshot.groupIndex,
        groupPicks: snapshot.groupPicks,
        qualifierIds: snapshot.qualifierIds,
        loserIds: snapshot.loserIds,
        wildcardPicks: snapshot.wildcardPicks,
      },
      groups,
      config,
    )
  ) {
    return false;
  }

  if (snapshot.phase === 'groups') {
    const currentGroupIds = new Set(groups[snapshot.groupIndex]?.map((skin) => skin.id));
    return (
      snapshot.groupIndex < groups.length &&
      snapshot.groupPicks.length <= config.picksPerGroup &&
      snapshot.groupPicks.every((id) => currentGroupIds.has(id)) &&
      snapshot.bracket.length === 0 &&
      snapshot.roundIndex === 0 &&
      snapshot.matchIndex === 0
    );
  }

  if (snapshot.groupIndex !== groups.length || snapshot.groupPicks.length !== 0) {
    return false;
  }

  if (snapshot.phase === 'revival') {
    return (
      snapshot.bracket.length === 0 &&
      snapshot.roundIndex === 0 &&
      snapshot.matchIndex === 0
    );
  }

  if (snapshot.phase === 'complete') {
    return false;
  }

  if (!isCausalBracket(snapshot.bracket, snapshot.qualifierIds)) {
    return false;
  }

  const currentRound = snapshot.bracket[snapshot.roundIndex];
  return (
    snapshot.bracket.length > 0 &&
    snapshot.roundIndex === snapshot.bracket.length - 1 &&
    snapshot.matchIndex < currentRound.length &&
    currentRound.slice(0, snapshot.matchIndex).every((match) => match.winnerId !== null) &&
    currentRound.slice(snapshot.matchIndex).every((match) => match.winnerId === null)
  );
}

function isTournamentState(value: unknown): value is TournamentState {
  if (!isRecord(value) || typeof value.weapon !== 'string' || !weapons.has(value.weapon as WeaponId)) {
    return false;
  }

  const weapon = value.weapon as WeaponId;
  const currentConfig = weaponConfigs[weapon];
  const currentEntrants = skinCatalog.filter((skin) => skin.weapon === weapon);
  const currentById = new Map<string, Skin>(currentEntrants.map((skin) => [skin.id, skin]));

  if (
    !sameJson(value.config, currentConfig) ||
    typeof value.seed !== 'string' ||
    value.seed.length === 0 ||
    !isInteger(value.restartCount) ||
    value.restartCount < 0 ||
    !isSkinArray(value.entrants, currentById) ||
    value.entrants.length !== currentEntrants.length
  ) {
    return false;
  }

  const entrantIds = new Set(value.entrants.map((skin) => skin.id));
  const currentIds = new Set(currentEntrants.map((skin) => skin.id));
  if (entrantIds.size !== currentIds.size || [...currentIds].some((id) => !entrantIds.has(id))) {
    return false;
  }

  if (
    typeof value.phase !== 'string' ||
    !phases.has(value.phase) ||
    !Array.isArray(value.groups) ||
    !value.groups.every((group) => isSkinArray(group, currentById)) ||
    value.groups.length !== currentConfig.groupSizes.length ||
    value.groups.some(
      (group, index) => group.length !== currentConfig.groupSizes[index],
    ) ||
    new Set(value.groups.flat().map((skin) => skin.id)).size !== currentIds.size ||
    isInteger(value.groupIndex) === false ||
    value.groupIndex < 0 ||
    value.groupIndex > value.groups.length ||
    !isStringArray(value.groupPicks) ||
    !isSkinArray(value.qualifiers, currentById) ||
    !isSkinArray(value.losers, currentById) ||
    !isStringArray(value.wildcardPicks) ||
    !Array.isArray(value.bracket) ||
    !value.bracket.every(
      (round) =>
        Array.isArray(round) &&
        round.every(
          (match) =>
            isRecord(match) &&
            Array.isArray(match.skins) &&
            match.skins.length === 2 &&
            isCurrentSkin(match.skins[0], currentById) &&
            isCurrentSkin(match.skins[1], currentById) &&
            (match.winner === null ||
              (isCurrentSkin(match.winner, currentById) &&
                match.skins.some((skin) => skin.id === (match.winner as Skin).id))),
        ),
    ) ||
    !isInteger(value.roundIndex) ||
    value.roundIndex < 0 ||
    !isInteger(value.matchIndex) ||
    value.matchIndex < 0 ||
    !(value.champion === null || isCurrentSkin(value.champion, currentById)) ||
    !(value.runnerUp === null || isCurrentSkin(value.runnerUp, currentById)) ||
    !Array.isArray(value.history) ||
    !value.history.every((snapshot) =>
      isSnapshot(
        snapshot,
        entrantIds,
        value.groups as readonly (readonly Skin[])[],
        currentConfig,
      ),
    )
  ) {
    return false;
  }

  const allReferenceIds = [
    ...value.groupPicks,
    ...value.qualifiers.map((skin) => skin.id),
    ...value.losers.map((skin) => skin.id),
    ...value.wildcardPicks,
  ];
  if (allReferenceIds.some((id) => !entrantIds.has(id))) {
    return false;
  }

  const state = value as unknown as TournamentState;
  if (
    !isReachablePartition(
      {
        phase: state.phase,
        groupIndex: state.groupIndex,
        groupPicks: state.groupPicks,
        qualifierIds: state.qualifiers.map((skin) => skin.id),
        loserIds: state.losers.map((skin) => skin.id),
        wildcardPicks: state.wildcardPicks,
      },
      state.groups,
      currentConfig,
    )
  ) {
    return false;
  }

  if (value.phase === 'groups') {
    const currentGroupIds = new Set(value.groups[value.groupIndex]?.map((skin) => skin.id));
    return (
      value.groupIndex < value.groups.length &&
      value.groupPicks.length <= currentConfig.picksPerGroup &&
      value.groupPicks.every((id) => currentGroupIds.has(id)) &&
      value.bracket.length === 0 &&
      value.roundIndex === 0 &&
      value.matchIndex === 0 &&
      value.champion === null &&
      isCausalHistory(state)
    );
  }

  if (value.groupIndex !== value.groups.length || value.groupPicks.length !== 0) {
    return false;
  }

  if (value.phase === 'revival') {
    return (
      value.bracket.length === 0 &&
      value.roundIndex === 0 &&
      value.matchIndex === 0 &&
      value.champion === null &&
      isCausalHistory(state)
    );
  }

  if (value.bracket.length === 0 || value.roundIndex >= value.bracket.length) {
    return false;
  }

  if (!isCausalBracket(stateBracketReferences(state.bracket), state.qualifiers.map((skin) => skin.id))) {
    return false;
  }

  if (value.phase === 'knockout') {
    const knockoutState = value as unknown as TournamentState;
    const currentRound = knockoutState.bracket[knockoutState.roundIndex];
    return (
      knockoutState.roundIndex === knockoutState.bracket.length - 1 &&
      knockoutState.matchIndex < currentRound.length &&
      currentRound
        .slice(0, knockoutState.matchIndex)
        .every((match) => match.winner !== null) &&
      currentRound
        .slice(knockoutState.matchIndex)
        .every((match) => match.winner === null) &&
      knockoutState.champion === null &&
      isCausalHistory(knockoutState)
    );
  }

  const completeState = value as unknown as TournamentState;
  const finalRoundIndex = completeState.bracket.length - 1;
  const finalRound = completeState.bracket[finalRoundIndex];
  const finalMatch = finalRound?.[0];

  return (
    completeState.champion !== null &&
    completeState.runnerUp !== null &&
    completeState.roundIndex === finalRoundIndex &&
    finalRound.length === 1 &&
    completeState.matchIndex === 0 &&
    finalMatch.winner?.id === completeState.champion.id &&
    finalMatch.skins.some((skin) => skin.id === completeState.runnerUp?.id) &&
    isCausalHistory(completeState)
  );
}

export function loadTournament(): TournamentState | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== STORAGE_VERSION || !isTournamentState(saved.state)) {
      return null;
    }

    return saved.state;
  } catch {
    return null;
  }
}

export function saveTournament(state: TournamentState): boolean {
  try {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearTournament(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage access can be denied; gameplay remains in memory.
  }
}
