import type { TournamentState } from '../domain/types';
import { SkinCard } from './SkinCard';

interface GroupStageProps {
  readonly state: TournamentState;
  readonly onToggle: (skinId: string) => void;
}

export function GroupStage({ state, onToggle }: GroupStageProps) {
  const currentGroup = state.groups[state.groupIndex];
  const selectionFull = state.groupPicks.length === state.config.picksPerGroup;

  function select(skinId: string) {
    if (!selectionFull || state.groupPicks.includes(skinId)) {
      onToggle(skinId);
    }
  }

  return (
    <section className="stage stage--group" aria-labelledby="group-heading">
      <header className="stage__heading">
        <h1 id="group-heading">小组赛</h1>
        <p>第 {state.groupIndex + 1} / {state.groups.length} 组</p>
        <p>选择 {state.config.picksPerGroup} 款，选满后自动晋级</p>
      </header>
      <div className="skin-grid skin-grid--group">
        {currentGroup.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            selected={state.groupPicks.includes(skin.id)}
            onSelect={select}
          />
        ))}
      </div>
    </section>
  );
}
