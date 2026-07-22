import type { TournamentState } from '../domain/types';
import { SkinCard } from './SkinCard';

interface GroupStageProps {
  readonly state: TournamentState;
  readonly onToggle: (skinId: string) => void;
  readonly onConfirm: () => void;
}

export function GroupStage({ state, onToggle, onConfirm }: GroupStageProps) {
  const currentGroup = state.groups[state.groupIndex];
  const selectionFull = state.groupPicks.length === state.config.picksPerGroup;

  function select(skinId: string) {
    if (!selectionFull || state.groupPicks.includes(skinId)) {
      onToggle(skinId);
    }
  }

  return (
    <section className="stage" aria-labelledby="group-heading">
      <header className="stage__heading">
        <h1 id="group-heading">小组赛</h1>
        <p>第 {state.groupIndex + 1} / {state.groups.length} 组</p>
        <p>选择 {state.config.picksPerGroup} 款晋级皮肤</p>
      </header>
      <div className="skin-grid">
        {currentGroup.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            selected={state.groupPicks.includes(skin.id)}
            onSelect={select}
          />
        ))}
      </div>
      <button
        type="button"
        className="primary-action"
        disabled={!selectionFull}
        onClick={onConfirm}
      >
        确认晋级
      </button>
    </section>
  );
}
