import { useEffect, useState } from 'react';
import type { TournamentPhase } from '../domain/types';

const phaseLabels: Record<TournamentPhase, string> = {
  groups: '小组赛',
  revival: '复活赛',
  knockout: '淘汰赛',
  complete: '冠军诞生',
};

interface TopBarProps {
  readonly weaponLabel: string;
  readonly phase: TournamentPhase;
  readonly progress: number;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
}

export function TopBar({
  weaponLabel,
  phase,
  progress,
  canUndo,
  onUndo,
  onRestart,
}: TopBarProps) {
  const [restartArmed, setRestartArmed] = useState(false);

  useEffect(() => {
    setRestartArmed(false);
  }, [phase, progress]);

  function requestRestart() {
    if (!restartArmed) {
      setRestartArmed(true);
      return;
    }
    setRestartArmed(false);
    onRestart();
  }

  return (
    <header className="top-bar">
      <div>
        <strong>{weaponLabel}</strong>
        <span>{phaseLabels[phase]} · {Math.round(progress * 100)}%</span>
      </div>
      <nav aria-label="赛事操作">
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          撤销上一步
        </button>
        <button
          type="button"
          className={restartArmed ? 'danger-action' : undefined}
          onClick={requestRestart}
        >
          {restartArmed ? '再次点击确认重开' : '重新开始'}
        </button>
      </nav>
    </header>
  );
}
