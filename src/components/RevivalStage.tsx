import { useState } from 'react';
import type { Skin } from '../domain/types';
import { SkinCard } from './SkinCard';

interface RevivalStageProps {
  readonly candidates: readonly Skin[];
  readonly wildcardCount: number;
  readonly onConfirm: (skinIds: readonly string[]) => void;
}

export function RevivalStage({ candidates, wildcardCount, onConfirm }: RevivalStageProps) {
  const [selected, setSelected] = useState<readonly string[]>([]);

  function toggle(skinId: string) {
    setSelected((current) => {
      if (current.includes(skinId)) {
        return current.filter((id) => id !== skinId);
      }
      if (current.length === wildcardCount) {
        return current;
      }
      return [...current, skinId];
    });
  }

  return (
    <section className="stage" aria-labelledby="revival-heading">
      <header className="stage__heading">
        <h1 id="revival-heading">复活赛</h1>
        <p>从落选皮肤中选择 {wildcardCount} 个复活名额</p>
      </header>
      <div className="skin-grid">
        {candidates.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            selected={selected.includes(skin.id)}
            onSelect={toggle}
          />
        ))}
      </div>
      <button
        type="button"
        className="primary-action"
        disabled={selected.length !== wildcardCount}
        onClick={() => onConfirm(selected)}
      >
        确认复活
      </button>
    </section>
  );
}
