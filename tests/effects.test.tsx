import { render, screen, within } from '@testing-library/react';
import { SkinCard } from '../src/components/SkinCard';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import { localizeEffectLabel } from '../src/domain/effects';
import type { Skin } from '../src/domain/types';

const knownEffects = {
  VFX: '枪身特效',
  Animation: '特殊动画',
  Finisher: '终结特效',
  FishAnimation: '鱼群动画',
  InspectAndKill: '特殊检视/击杀',
  KillBanner: '击杀横幅',
  KillCounter: '击杀计数',
  KillEffect: '击杀特效',
  Randomizer: '随机效果',
  SongShuffle: '音乐切换',
  SoundEffects: '专属音效',
  Transformation: '形态变换',
  Voiceover: '专属语音',
} as const;

it('maps every known effect enum to the approved simplified-Chinese label', () => {
  expect(
    Object.fromEntries(
      Object.keys(knownEffects).map((effect) => [effect, localizeEffectLabel(effect)]),
    ),
  ).toEqual(knownEffects);
});

it('returns a safe readable fallback for unknown or empty effect values', () => {
  expect(localizeEffectLabel('FutureEffect')).toBe('FutureEffect');
  expect(localizeEffectLabel('')).toBe('其他特效');
  expect(localizeEffectLabel('   ')).toBe('其他特效');
});

it('renders all known effect labels in Chinese and keeps the group aria label localized', () => {
  const skin: Skin = {
    ...skinCatalog[0],
    id: 'all-effect-labels',
    effects: Object.keys(knownEffects),
  };
  render(<SkinCard skin={skin} onSelect={() => {}} />);

  const effectGroup = screen.getByLabelText('特效标签');
  for (const [effect, label] of Object.entries(knownEffects)) {
    expect(within(effectGroup).getByText(label)).toBeInTheDocument();
    expect(within(effectGroup).queryByText(effect)).not.toBeInTheDocument();
  }
});

it('never exposes known English enum labels on a real generated-catalog card', () => {
  const skin = skinCatalog.find((candidate) => candidate.effects.length >= 3)!;
  render(<SkinCard skin={skin} onSelect={() => {}} />);

  const effectGroup = screen.getByLabelText('特效标签');
  for (const effect of skin.effects) {
    expect(within(effectGroup).getByText(localizeEffectLabel(effect))).toBeInTheDocument();
    expect(within(effectGroup).queryByText(effect)).not.toBeInTheDocument();
  }
});
