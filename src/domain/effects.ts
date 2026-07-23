export const EFFECT_LABELS = {
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
} as const satisfies Readonly<Record<string, string>>;

export function localizeEffectLabel(effect: string): string {
  const normalized = effect.trim();
  if (!normalized) {
    return '其他特效';
  }

  return EFFECT_LABELS[normalized as keyof typeof EFFECT_LABELS] ?? normalized;
}
