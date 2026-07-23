import { act, render, screen } from '@testing-library/react';
import { KnockoutStage } from '../src/components/KnockoutStage';
import {
  ROUND_INTRO_DURATION_MS,
  RoundIntro,
} from '../src/components/RoundIntro';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import { getRoundDescriptor } from '../src/domain/bracket';

const sheriffSkins = skinCatalog
  .filter((skin) => skin.weapon === 'sheriff')
  .slice(0, 2);
const match = {
  skins: [sheriffSkins[0], sheriffSkins[1]] as const,
  winner: null,
};

afterEach(() => {
  vi.useRealTimers();
});

it('announces the formal round name and completes after the configured duration', () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();

  render(
    <RoundIntro
      descriptor={getRoundDescriptor(32, 1)}
      onComplete={onComplete}
    />,
  );

  expect(screen.getByRole('status')).toHaveTextContent('1/8 决赛');
  expect(screen.getByRole('status')).toHaveTextContent('16 款皮肤 · 8 场对决');

  act(() => {
    vi.advanceTimersByTime(ROUND_INTRO_DURATION_MS - 1);
  });
  expect(onComplete).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(onComplete).toHaveBeenCalledOnce();
});

it('shows the intro for the first match and removes it when the timer completes', () => {
  vi.useFakeTimers();

  render(
    <KnockoutStage
      bracketSize={16}
      roundIndex={0}
      match={match}
      matchNumber={1}
      matchCount={8}
      onChoose={() => {}}
    />,
  );

  expect(screen.getByRole('status')).toHaveTextContent('1/8 决赛');
  expect(screen.getByRole('heading', { name: '1/8 决赛' })).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(ROUND_INTRO_DURATION_MS);
  });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('第 1 / 8 场')).toBeInTheDocument();
});

it('does not repeat the intro when resuming in the middle of a round', () => {
  render(
    <KnockoutStage
      bracketSize={16}
      roundIndex={0}
      match={match}
      matchNumber={3}
      matchCount={8}
      onChoose={() => {}}
    />,
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '1/8 决赛' })).toBeInTheDocument();
  expect(screen.getByText('第 3 / 8 场')).toBeInTheDocument();
});
