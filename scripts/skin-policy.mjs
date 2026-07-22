export const weaponIds = {
  狂徒: 'vandal',
  幻影: 'phantom',
  正义: 'sheriff',
};

export const allowedEffectItems = new Set([
  'VFX',
  'Animation',
  'Finisher',
  'SoundEffects',
  'InspectAndKill',
  'Transformation',
  'SongShuffle',
  'KillEffect',
  'Voiceover',
  'KillBanner',
  'FishAnimation',
  'AttackerDefenderSwap',
  'HeartbeatAndMapSensor',
  'KillCounter',
  'Randomizer',
]);

export const approvedSpecialSkinNames = new Set([
  '2025全球冠军赛 狂徒',
  '海洋之星 狂徒',
  '侦察力量 幻影',
  '猩红猛兽 正义',
]);

export const rejectedSkinNames = new Set([
  '黑市 狂徒',
  '猩红猛兽 狂徒',
  '灵魂冲击 幻影',
  '涂鸦伙伴 幻影',
  '异形猎人 幻影',
]);

export const weaponConfigs = {
  vandal: {
    label: '狂徒',
    expectedCount: 42,
    groupSizes: Array(14).fill(3),
    picksPerGroup: 2,
    wildcardSlots: 4,
    bracketSize: 32,
  },
  phantom: {
    label: '幻影',
    expectedCount: 36,
    groupSizes: Array(12).fill(3),
    picksPerGroup: 2,
    wildcardSlots: 8,
    bracketSize: 32,
  },
  sheriff: {
    label: '正义',
    expectedCount: 24,
    groupSizes: Array(6).fill(4),
    picksPerGroup: 2,
    wildcardSlots: 4,
    bracketSize: 16,
  },
};

const goSkinPattern = /无畏契约\s*GO|VALORANT\s*GO/i;

function effectName(levelItem) {
  const parts = levelItem.split('::');
  return parts[parts.length - 1] ?? levelItem;
}

function approvedEffects(levels) {
  return [
    ...new Set(
      levels
        .map((level) => level.levelItem)
        .filter((levelItem) => typeof levelItem === 'string')
        .map(effectName)
        .filter((levelItem) => allowedEffectItems.has(levelItem)),
    ),
  ];
}

export function filterRawCatalog(rawSkins) {
  const catalog = new Map();

  for (const rawSkin of rawSkins) {
    const weapon = weaponIds[rawSkin.weapon];
    const effects = approvedEffects(rawSkin.levels);
    const isApprovedSpecial = approvedSpecialSkinNames.has(rawSkin.name);

    if (
      !weapon ||
      rawSkin.tierRank < 2 ||
      goSkinPattern.test(rawSkin.name) ||
      rejectedSkinNames.has(rawSkin.name) ||
      (!isApprovedSpecial && effects.length === 0)
    ) {
      continue;
    }

    catalog.set(rawSkin.id, {
      id: rawSkin.id,
      name: rawSkin.name,
      weapon,
      tier: rawSkin.tier,
      tierRank: rawSkin.tierRank,
      effects,
      image: rawSkin.image,
      fullRender: rawSkin.fullRender,
    });
  }

  return [...catalog.values()].sort(
    (left, right) =>
      left.weapon.localeCompare(right.weapon) ||
      left.name.localeCompare(right.name, 'zh-CN') ||
      left.id.localeCompare(right.id),
  );
}
