import type { TournamentMatch } from '../domain/types';
import { SkinCard } from './SkinCard';

interface DuelStageProps {
  readonly match: TournamentMatch;
  readonly matchNumber: number;
  readonly matchCount: number;
  readonly roundTitle: string;
  readonly onChoose: (skinId: string) => void;
}

export function DuelStage({
  match,
  matchNumber,
  matchCount,
  roundTitle,
  onChoose,
}: DuelStageProps) {
  return (
    <section className="stage" aria-labelledby="duel-heading">
      <header className="stage__heading">
        <span className="eyebrow">KNOCKOUT</span>
        <h1 id="duel-heading">{roundTitle}</h1>
        <p>第 {matchNumber} / {matchCount} 场</p>
        <p>选择本场胜者</p>
      </header>
      <div className="skin-grid skin-grid--duel">
        {match.skins.map((skin) => (
          <SkinCard key={skin.id} skin={skin} onSelect={onChoose} />
        ))}
      </div>
    </section>
  );
}
