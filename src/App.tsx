import { useState } from 'react';
import { DuelStage } from './components/DuelStage';
import { GroupStage } from './components/GroupStage';
import { RevivalStage } from './components/RevivalStage';
import { TopBar } from './components/TopBar';
import { WeaponSelect } from './components/WeaponSelect';
import { weaponConfigs } from './domain/catalog';
import { skinCatalog } from './data/generated-skin-catalog';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
  progress as tournamentProgress,
  restart,
  toggleGroupPick,
  undo,
} from './domain/tournament';
import type { TournamentState, WeaponId } from './domain/types';
import { loadTournament, saveTournament } from './lib/storage';

const weaponOrder: readonly WeaponId[] = ['vandal', 'phantom', 'sheriff'];
const weaponOptions = weaponOrder.map((id) => ({
  id,
  label: weaponConfigs[id].label,
  count: skinCatalog.filter((skin) => skin.weapon === id).length,
}));

function freshSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [state, setState] = useState<TournamentState | null>(() => loadTournament());

  function commit(next: TournamentState) {
    setState(next);
    saveTournament(next);
  }

  function start(weapon: WeaponId) {
    commit(
      createTournament(
        skinCatalog.filter((skin) => skin.weapon === weapon),
        weaponConfigs[weapon],
        freshSeed(),
      ),
    );
  }

  if (state === null) {
    return <WeaponSelect weapons={weaponOptions} onSelect={start} />;
  }

  const currentRound = state.bracket[state.roundIndex];
  const currentMatch = currentRound?.[state.matchIndex];

  return (
    <div className="tournament-shell">
      <TopBar
        weaponLabel={state.config.label}
        phase={state.phase}
        progress={tournamentProgress(state)}
        canUndo={state.history.length > 0}
        onUndo={() => commit(undo(state))}
        onRestart={() => commit(restart(state, freshSeed()))}
      />
      <main className="tournament-main">
        {state.phase === 'groups' && (
          <GroupStage
            state={state}
            onToggle={(skinId) => commit(toggleGroupPick(state, skinId))}
            onConfirm={() => commit(confirmGroupPick(state))}
          />
        )}
        {state.phase === 'revival' && (
          <RevivalStage
            candidates={state.losers}
            wildcardCount={state.config.wildcardSlots}
            onConfirm={(skinIds) => commit(confirmWildcards(state, skinIds))}
          />
        )}
        {state.phase === 'knockout' && currentMatch && (
          <DuelStage
            match={currentMatch}
            matchNumber={state.matchIndex + 1}
            matchCount={currentRound.length}
            roundNumber={state.roundIndex + 1}
            onChoose={(skinId) => commit(chooseWinner(state, skinId))}
          />
        )}
        {state.phase === 'complete' && (
          <section className="stage complete-placeholder" aria-labelledby="complete-heading">
            <h1 id="complete-heading">冠军诞生</h1>
            <p>{state.champion?.name}</p>
          </section>
        )}
      </main>
    </div>
  );
}
