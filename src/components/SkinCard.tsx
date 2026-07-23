import { useEffect, useState } from 'react';
import { localizeEffectLabel } from '../domain/effects';
import type { Skin } from '../domain/types';

interface SkinCardProps {
  readonly skin: Skin;
  readonly selected?: boolean;
  readonly onSelect: (skinId: string) => void;
}

export function SkinCard({ skin, selected = false, onSelect }: SkinCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = skin.fullRender ?? skin.image;

  useEffect(() => {
    setImageFailed(false);
  }, [skin.id]);

  return (
    <button
      type="button"
      className={`skin-card${selected ? ' skin-card--selected' : ''}`}
      aria-label={`选择 ${skin.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(skin.id)}
    >
      <span className="skin-card__visual">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={`${skin.name} 皮肤图片`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className="skin-card__placeholder"
            role="img"
            aria-label={`${skin.name} ${imageFailed ? '图片加载失败' : '暂无图片'}`}
          >
            图片暂不可用
          </span>
        )}
      </span>
      <strong>{skin.name}</strong>
      <span className="skin-card__tier">{skin.tier}</span>
      <span className="skin-card__effects" aria-label="特效标签">
        {skin.effects.filter(Boolean).map((effect) => (
          <span key={effect}>{localizeEffectLabel(effect)}</span>
        ))}
      </span>
    </button>
  );
}
