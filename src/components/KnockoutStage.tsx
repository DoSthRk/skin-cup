import { useCallback, useState } from 'react';
import { getRoundDescriptor } from '../domain/bracket';
import type { TournamentMatch } from '../domain/types';
import { DuelStage } from './DuelStage';
import { RoundIntro } from './RoundIntro';

interface KnockoutStageProps {
  readonly bracketSize: number;
  readonly roundIndex: number;
  readonly match: TournamentMatch;
  readonly matchNumber: number;
  readonly matchCount: number;
  readonly onChoose: (skinId: string) => void;
}

export function KnockoutStage({
  bracketSize,
  roundIndex,
  match,
  matchNumber,
  matchCount,
  onChoose,
}: KnockoutStageProps) {
  const [showIntro, setShowIntro] = useState(matchNumber === 1);
  const descriptor = getRoundDescriptor(bracketSize, roundIndex);
  const finishIntro = useCallback(() => setShowIntro(false), []);

  return (
    <>
      <DuelStage
        match={match}
        matchNumber={matchNumber}
        matchCount={matchCount}
        roundTitle={descriptor.title}
        onChoose={onChoose}
      />
      {showIntro && (
        <RoundIntro descriptor={descriptor} onComplete={finishIntro} />
      )}
    </>
  );
}
