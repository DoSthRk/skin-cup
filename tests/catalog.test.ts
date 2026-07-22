import { filterCatalog, weaponConfigs } from '../src/domain/catalog';
import { rawSkins } from './fixtures/catalog-source';

describe('filterCatalog', () => {
  it('keeps high-tier target-weapon skins with an approved effect', () => {
    expect(filterCatalog(rawSkins).map((skin) => skin.name)).toContain('合规特效 狂徒');
  });

  it('removes GO skins, low tiers, plain skins, and other weapons', () => {
    const names = filterCatalog(rawSkins).map((skin) => skin.name);

    for (const rejectedName of [
      '无畏契约 GO! Vol. 1 狂徒',
      '无畏契约GO 幻影',
      'VALORANT GO! Vol. 2 正义',
      '低级特效 狂徒',
      '无特效 狂徒',
      '合规特效 戍卫',
    ]) {
      expect(names).not.toContain(rejectedName);
    }
  });

  it('keeps all approved no-effect exceptions', () => {
    expect(filterCatalog(rawSkins).map((skin) => skin.name)).toEqual(
      expect.arrayContaining([
        '2025全球冠军赛 狂徒',
        '海洋之星 狂徒',
        '侦察力量 幻影',
        '猩红猛兽 正义',
      ]),
    );
  });

  it('always rejects the five user-rejected border skins', () => {
    const names = filterCatalog(rawSkins).map((skin) => skin.name);

    for (const rejectedName of [
      '黑市 狂徒',
      '猩红猛兽 狂徒',
      '灵魂冲击 幻影',
      '涂鸦伙伴 幻影',
      '异形猎人 幻影',
    ]) {
      expect(names).not.toContain(rejectedName);
    }
  });

  it('exposes the configured bracket capacities', () => {
    expect(weaponConfigs).toEqual({
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
    });
  });
});
