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
