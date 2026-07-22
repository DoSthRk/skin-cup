import { fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import { SkinCard } from '../src/components/SkinCard';
import { weaponConfigs } from '../src/domain/catalog';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import {
  confirmGroupPick,
  confirmWildcards,
  createTournament,
} from '../src/domain/tournament';
import type { TournamentState, WeaponId } from '../src/domain/types';
import { loadTournament, saveTournament } from '../src/lib/storage';

function createState(weapon: WeaponId, seed = `${weapon}-ui-test`): TournamentState {
  return createTournament(
    skinCatalog.filter((skin) => skin.weapon === weapon),
    weaponConfigs[weapon],
    seed,
  );
}

function finishGroups(state: TournamentState): TournamentState {
  let current = state;
  while (current.phase === 'groups') {
    current = confirmGroupPick(
      current,
      current.groups[current.groupIndex]
        .slice(0, current.config.picksPerGroup)
        .map((skin) => skin.id),
    );
  }
  return current;
}

function stateAtLastGroup(): TournamentState {
  let state = createState('sheriff');
  while (state.phase === 'groups' && state.groupIndex < state.groups.length - 1) {
    state = confirmGroupPick(
      state,
      state.groups[state.groupIndex].slice(0, 2).map((skin) => skin.id),
    );
  }
  return state;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('shows enabled launch controls with the exact generated counts', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '皮肤之巅' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /狂徒.*42/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /幻影.*36/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /正义.*24/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /狂徒.*42/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /幻影.*36/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /正义.*24/ })).toBeEnabled();
});

it('starts a fresh tournament for the chosen weapon', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /正义.*24/ }));

  expect(screen.getByRole('heading', { name: '小组赛' })).toBeInTheDocument();
  expect(screen.getByText('第 1 / 6 组')).toBeInTheDocument();
  expect(loadTournament()).toMatchObject({ weapon: 'sheriff', phase: 'groups' });
  expect(loadTournament()?.seed).toBeTruthy();
});

it('confirms exactly two group picks and clears selection for the next group', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /正义.*24/ }));

  const firstState = loadTournament()!;
  for (const skin of firstState.groups[0].slice(0, 2)) {
    fireEvent.click(screen.getByRole('button', { name: `选择 ${skin.name}` }));
  }
  expect(screen.getByRole('button', { name: '确认晋级' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '确认晋级' }));

  expect(screen.getByText('第 2 / 6 组')).toBeInTheDocument();
  for (const button of screen.getAllByRole('button', { name: /^选择 / })) {
    expect(button).toHaveAttribute('aria-pressed', 'false');
  }
  expect(loadTournament()?.groupIndex).toBe(1);
});

it('moves from the final group into revival', () => {
  const state = stateAtLastGroup();
  saveTournament(state);
  render(<App />);

  for (const skin of state.groups[state.groupIndex].slice(0, 2)) {
    fireEvent.click(screen.getByRole('button', { name: `选择 ${skin.name}` }));
  }
  fireEvent.click(screen.getByRole('button', { name: '确认晋级' }));

  expect(screen.getByRole('heading', { name: '复活赛' })).toBeInTheDocument();
  expect(screen.getByText('从落选皮肤中选择 4 个复活名额')).toBeInTheDocument();
});

it('selects configured loser wildcards and starts the knockout bracket', () => {
  const grouped = finishGroups(createState('sheriff'));
  saveTournament(grouped);
  render(<App />);

  for (const skin of grouped.losers.slice(0, grouped.config.wildcardSlots)) {
    fireEvent.click(screen.getByRole('button', { name: `选择 ${skin.name}` }));
  }
  fireEvent.click(screen.getByRole('button', { name: '确认复活' }));

  expect(screen.getByRole('heading', { name: '淘汰赛' })).toBeInTheDocument();
  expect(screen.getByText('第 1 / 8 场')).toBeInTheDocument();
  expect(loadTournament()?.phase).toBe('knockout');
});

it('chooses one current duel skin and advances to the next match', () => {
  const grouped = finishGroups(createState('sheriff'));
  const knockout = confirmWildcards(
    grouped,
    grouped.losers.slice(0, grouped.config.wildcardSlots).map((skin) => skin.id),
  );
  saveTournament(knockout);
  render(<App />);

  const winner = knockout.bracket[0][0].skins[0];
  fireEvent.click(screen.getByRole('button', { name: `选择 ${winner.name}` }));

  expect(screen.getByText('第 2 / 8 场')).toBeInTheDocument();
  expect(loadTournament()?.matchIndex).toBe(1);
});

it('resumes valid progress and supports undo', () => {
  const initial = createState('sheriff');
  const progressed = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, 2).map((skin) => skin.id),
  );
  saveTournament(progressed);
  render(<App />);

  expect(screen.getByText('第 2 / 6 组')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '撤销上一步' }));
  expect(screen.getByText('第 1 / 6 组')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '撤销上一步' })).toBeDisabled();
  expect(loadTournament()?.groupIndex).toBe(0);
});

it('requires a clear second action before restarting the current weapon', () => {
  const initial = createState('sheriff', 'before-restart');
  const progressed = confirmGroupPick(
    initial,
    initial.groups[0].slice(0, 2).map((skin) => skin.id),
  );
  saveTournament(progressed);
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '重新开始' }));
  expect(screen.getByText('第 2 / 6 组')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '再次点击确认重开' }));

  expect(screen.getByText('第 1 / 6 组')).toBeInTheDocument();
  expect(loadTournament()).toMatchObject({ phase: 'groups', groupIndex: 0, history: [] });
  expect(loadTournament()?.seed).not.toBe('before-restart');
});

it('keeps a skin selectable after replacing a failed remote image', () => {
  const skin = skinCatalog.find((candidate) => candidate.weapon === 'sheriff')!;
  const onSelect = vi.fn();
  render(<SkinCard skin={skin} selected={false} onSelect={onSelect} />);

  fireEvent.error(screen.getByRole('img', { name: `${skin.name} 皮肤图片` }));

  expect(screen.getByRole('img', { name: `${skin.name} 图片加载失败` })).toBeInTheDocument();
  const button = screen.getByRole('button', { name: `选择 ${skin.name}` });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledWith(skin.id);
});
