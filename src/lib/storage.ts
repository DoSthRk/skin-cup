import { weaponConfigs } from '../domain/catalog';
import type {
  Skin,
  TournamentMatchSnapshot,
  TournamentSnapshot,
  TournamentState,
  WeaponId,
} from '../domain/types';
import { skinCatalog } from '../data/generated-skin-catalog';

export const STORAGE_KEY = 'skin-cup:v1';
const STORAGE_VERSION = 1;
const phases = new Set(['groups', 'revival', 'knockout', 'complete']);
const weapons = new Set<WeaponId>(['vandal', 'phantom', 'sheriff']);

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
  picksPerGroup: number,
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

  if (new Set(snapshot.groupPicks).size !== snapshot.groupPicks.length) {
    return false;
  }

  if (snapshot.phase === 'groups') {
    const currentGroupIds = new Set(groups[snapshot.groupIndex]?.map((skin) => skin.id));
    return (
      snapshot.groupIndex < groups.length &&
      snapshot.groupPicks.length <= picksPerGroup &&
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

  return (
    snapshot.bracket.length > 0 &&
    snapshot.roundIndex < snapshot.bracket.length &&
    snapshot.matchIndex < snapshot.bracket[snapshot.roundIndex].length
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
        currentConfig.picksPerGroup,
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

  if (value.phase === 'groups') {
    const currentGroupIds = new Set(value.groups[value.groupIndex]?.map((skin) => skin.id));
    return (
      value.groupIndex < value.groups.length &&
      value.groupPicks.length <= currentConfig.picksPerGroup &&
      value.groupPicks.every((id) => currentGroupIds.has(id)) &&
      value.bracket.length === 0 &&
      value.champion === null
    );
  }

  if (value.groupIndex !== value.groups.length || value.groupPicks.length !== 0) {
    return false;
  }

  if (value.phase === 'revival') {
    return value.bracket.length === 0 && value.champion === null;
  }

  if (value.bracket.length === 0 || value.roundIndex >= value.bracket.length) {
    return false;
  }

  if (value.phase === 'knockout') {
    return value.matchIndex < value.bracket[value.roundIndex].length && value.champion === null;
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
    finalMatch.skins.some((skin) => skin.id === completeState.runnerUp?.id)
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
