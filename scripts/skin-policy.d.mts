import type { RawSkin, Skin, WeaponConfig, WeaponId } from '../src/domain/types';

export const weaponIds: Record<string, WeaponId>;
export const allowedEffectItems: ReadonlySet<string>;
export const approvedSpecialSkinNames: ReadonlySet<string>;
export const rejectedSkinNames: ReadonlySet<string>;
export const weaponConfigs: Readonly<Record<WeaponId, WeaponConfig>>;

export function filterRawCatalog(rawSkins: readonly RawSkin[]): Skin[];
