import { useEffect } from 'react';
import type { RoundDescriptor } from '../domain/bracket';

interface RoundIntroProps {
  readonly descriptor: RoundDescriptor;
  readonly onComplete: () => void;
}

export const ROUND_INTRO_DURATION_MS = 1_600;

export function RoundIntro({ descriptor, onComplete }: RoundIntroProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, ROUND_INTRO_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="round-intro" role="status" aria-live="assertive">
      <div className="round-intro__frame">
        <span className="round-intro__brand">SKIN CUP</span>
        <strong>{descriptor.title}</strong>
        <p>
          {descriptor.entrantCount} 款皮肤 · {descriptor.matchCount} 场对决 ·
          选出本轮胜者
        </p>
      </div>
    </div>
  );
}
