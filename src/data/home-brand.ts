import type { WeaponId } from '../domain/types';

export interface WeaponCardArtwork {
  readonly src: string;
  readonly skinName: string;
}

export const weaponCardArtwork: Readonly<Record<WeaponId, WeaponCardArtwork>> = {
  vandal: {
    src: '/weapon-cards/vandal-sentinel.png',
    skinName: '光明哨兵 狂徒',
  },
  phantom: {
    src: '/weapon-cards/phantom-ion.png',
    skinName: '离子武器 幻影',
  },
  sheriff: {
    src: '/weapon-cards/sheriff-singularity.png',
    skinName: '奇点 正义',
  },
};
