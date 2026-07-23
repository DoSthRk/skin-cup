import { useEffect, useState } from 'react';
import type { RoundDescriptor } from '../domain/bracket';

interface RoundIntroProps {
  readonly descriptor: RoundDescriptor;
  readonly onComplete: () => void;
}

export const ROUND_INTRO_DURATION_MS = 1_600;
export const ROUND_INTRO_EXIT_MS = 260;

export function RoundIntro({ descriptor, onComplete }: RoundIntroProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimeoutId = window.setTimeout(
      () => setExiting(true),
      ROUND_INTRO_DURATION_MS - ROUND_INTRO_EXIT_MS,
    );
    const completeTimeoutId = window.setTimeout(
      onComplete,
      ROUND_INTRO_DURATION_MS,
    );
    return () => {
      window.clearTimeout(exitTimeoutId);
      window.clearTimeout(completeTimeoutId);
    };
  }, [onComplete]);

  return (
    <div
      className={`round-intro${exiting ? ' round-intro--exiting' : ''}`}
      role="status"
      aria-live="assertive"
    >
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
