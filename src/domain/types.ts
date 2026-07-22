export type WeaponId = 'vandal' | 'phantom' | 'sheriff';

export type WeaponLabel = '狂徒' | '幻影' | '正义';

export type TierRank = number;

export interface RawSkinLevel {
  readonly levelItem?: string | null;
}

export interface RawSkin {
  readonly id: string;
  readonly name: string;
  readonly weapon: string;
  readonly tier: string;
  readonly tierRank: TierRank;
  readonly levels: readonly RawSkinLevel[];
  readonly image: string | null;
  readonly fullRender: string | null;
}

export interface Skin {
  readonly id: string;
  readonly name: string;
  readonly weapon: WeaponId;
  readonly tier: string;
  readonly tierRank: TierRank;
  readonly effects: readonly string[];
  readonly image: string | null;
  readonly fullRender: string | null;
}

export interface WeaponConfig {
  readonly label: WeaponLabel;
  readonly expectedCount: number;
  readonly groupSizes: readonly number[];
  readonly picksPerGroup: number;
  readonly wildcardSlots: number;
  readonly bracketSize: number;
}

export type TournamentPhase = 'groups' | 'revival' | 'knockout' | 'complete';

export interface TournamentMatch {
  readonly skins: readonly [Skin, Skin];
  readonly winner: Skin | null;
}

export interface TournamentSnapshot {
  readonly weapon: WeaponId;
  readonly config: WeaponConfig;
  readonly seed: string;
  readonly restartCount: number;
  readonly entrants: readonly Skin[];
  readonly phase: TournamentPhase;
  readonly groups: readonly (readonly Skin[])[];
  readonly groupIndex: number;
  readonly groupPicks: readonly string[];
  readonly qualifiers: readonly Skin[];
  readonly losers: readonly Skin[];
  readonly wildcardPicks: readonly string[];
  readonly bracket: readonly (readonly TournamentMatch[])[];
  readonly roundIndex: number;
  readonly matchIndex: number;
  readonly champion: Skin | null;
  readonly runnerUp: Skin | null;
}

export interface TournamentState extends TournamentSnapshot {
  readonly history: readonly TournamentSnapshot[];
}
