import { useState } from 'react';
import { ChampionScreen } from './components/ChampionScreen';
import { GroupStage } from './components/GroupStage';
import { KnockoutStage } from './components/KnockoutStage';
import { RevivalStage } from './components/RevivalStage';
import { TopBar } from './components/TopBar';
import { WeaponSelect } from './components/WeaponSelect';
import { weaponConfigs } from './domain/catalog';
import { weaponCardArtwork } from './data/home-brand';
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
import { clearTournament, loadTournament, saveTournament } from './lib/storage';

const weaponOrder: readonly WeaponId[] = ['vandal', 'phantom', 'sheriff', 'melee'];
const weaponOptions = weaponOrder.map((id) => ({
  id,
  label: weaponConfigs[id].label,
  count: skinCatalog.filter((skin) => skin.weapon === id).length,
  artwork: weaponCardArtwork[id],
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

  function goHome() {
    clearTournament();
    setState(null);
  }

  if (state === null) {
    return <WeaponSelect weapons={weaponOptions} onSelect={start} />;
  }

  function selectGroupSkin(skinId: string) {
    if (state === null || state.phase !== 'groups') return;

    if (state.groupPicks.includes(skinId)) {
      commit(toggleGroupPick(state, skinId));
      return;
    }

    const selectedIds = [...state.groupPicks, skinId];
    if (selectedIds.length > state.config.picksPerGroup) {
      return;
    }
    if (selectedIds.length === state.config.picksPerGroup) {
      commit(confirmGroupPick(state, selectedIds));
      return;
    }

    commit(toggleGroupPick(state, skinId));
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
        onHome={goHome}
      />
      <main className="tournament-main">
        {state.phase === 'groups' && (
          <GroupStage
            state={state}
            onToggle={selectGroupSkin}
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
          <KnockoutStage
            key={`${state.seed}:${state.roundIndex}`}
            bracketSize={state.config.bracketSize}
            roundIndex={state.roundIndex}
            match={currentMatch}
            matchNumber={state.matchIndex + 1}
            matchCount={currentRound.length}
            onChoose={(skinId) => commit(chooseWinner(state, skinId))}
          />
        )}
        {state.phase === 'complete' && (
          <ChampionScreen
            state={state}
            onPlayAgain={() => commit(restart(state, freshSeed()))}
          />
        )}
      </main>
    </div>
  );
}
