import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { ChampionScreen } from '../src/components/ChampionScreen';
import { skinCatalog } from '../src/data/generated-skin-catalog';
import { weaponConfigs } from '../src/domain/catalog';
import {
  buildShareImage,
  buildBracketImage,
  DOWNLOAD_CLEANUP_DELAY_MS,
  deriveTournamentResult,
  downloadShareImage,
  SHARE_IMAGE_TIMEOUT_MS,
  shareShareImage,
} from '../src/lib/share';
import {
  chooseWinner,
  confirmGroupPick,
  confirmWildcards,
  createTournament,
} from '../src/domain/tournament';
import type { TournamentState } from '../src/domain/types';

function completedSheriffState(seed = 'completed-sheriff-test'): TournamentState {
  let state = createTournament(
    skinCatalog.filter((skin) => skin.weapon === 'sheriff'),
    weaponConfigs.sheriff,
    seed,
  );

  while (state.phase === 'groups') {
    state = confirmGroupPick(
      state,
      state.groups[state.groupIndex]
        .slice(0, state.config.picksPerGroup)
        .map((skin) => skin.id),
    );
  }

  state = confirmWildcards(
    state,
    state.losers.slice(0, state.config.wildcardSlots).map((skin) => skin.id),
  );

  while (state.phase === 'knockout') {
    state = chooseWinner(
      state,
      state.bracket[state.roundIndex][state.matchIndex].skins[0].id,
    );
  }

  return state;
}

function completedVandalState(seed = 'completed-vandal-test'): TournamentState {
  let state = createTournament(
    skinCatalog.filter((skin) => skin.weapon === 'vandal'),
    weaponConfigs.vandal,
    seed,
  );

  while (state.phase === 'groups') {
    state = confirmGroupPick(
      state,
      state.groups[state.groupIndex]
        .slice(0, state.config.picksPerGroup)
        .map((skin) => skin.id),
    );
  }

  state = confirmWildcards(
    state,
    state.losers.slice(0, state.config.wildcardSlots).map((skin) => skin.id),
  );

  while (state.phase === 'knockout') {
    state = chooseWinner(
      state,
      state.bracket[state.roundIndex][state.matchIndex].skins[0].id,
    );
  }

  return state;
}

const context = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 30 })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  textAlign: 'start' as CanvasTextAlign,
  textBaseline: 'alphabetic' as CanvasTextBaseline,
};

let loadedImages: Array<{ crossOrigin: string | null; src: string }> = [];
let imageShouldFail = false;
let imageShouldHang = false;
let mockImages: MockImage[] = [];
let exportedCanvasSizes: Array<{ width: number; height: number }> = [];

class MockImage {
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1200;
  naturalHeight = 600;
  width = 1200;
  height = 600;
  #src = '';

  set src(value: string) {
    this.#src = value;
    loadedImages.push({ crossOrigin: this.crossOrigin, src: value });
    if (imageShouldHang) {
      return;
    }
    queueMicrotask(() => {
      if (imageShouldFail) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }

  get src() {
    return this.#src;
  }
}

let anchorClick: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  loadedImages = [];
  imageShouldFail = false;
  imageShouldHang = false;
  mockImages = [];
  exportedCanvasSizes = [];
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.stubGlobal('Image', class extends MockImage {
    constructor() {
      super();
      mockImages.push(this);
    }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (this: HTMLCanvasElement, callback, type) {
      exportedCanvasSizes.push({ width: this.width, height: this.height });
      callback(new Blob(['x'.repeat(128)], { type: type ?? 'image/png' }));
    },
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:skin-cup'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('derives the champion, runner-up, four semifinalists and complete champion path', () => {
  const state = completedSheriffState();
  const result = deriveTournamentResult(state);

  expect(result.champion).toBe(state.champion);
  expect(result.runnerUp).toBe(state.runnerUp);
  expect(result.semifinalists.map((skin) => skin.id)).toEqual(
    state.bracket.at(-2)?.flatMap((match) => match.skins.map((skin) => skin.id)),
  );
  expect(result.semifinalists).toHaveLength(4);
  expect(result.path).toHaveLength(Math.log2(state.config.bracketSize));
  expect(result.path.at(-1)).toMatchObject({ opponent: state.runnerUp, label: '决赛' });
});

it('rejects a tournament that is not complete', () => {
  const state = completedSheriffState();
  expect(() => deriveTournamentResult({ ...state, phase: 'knockout' })).toThrow(
    '赛事尚未完成',
  );
});

it('creates a JPEG canvas at quality 0.92 with an anonymous remote image', async () => {
  const state = completedSheriffState();

  const blob = await buildShareImage(state);

  expect(blob.type).toBe('image/jpeg');
  expect(blob.size).toBeGreaterThan(100);
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
    expect.any(Function),
    'image/jpeg',
    0.92,
  );
  expect(loadedImages).toContainEqual({
    crossOrigin: 'anonymous',
    src: state.champion?.fullRender ?? state.champion?.image,
  });
  expect(context.drawImage).toHaveBeenCalled();
});

it('draws every formal knockout round and winner into a complete bracket JPEG', async () => {
  const state = completedSheriffState();

  const blob = await buildBracketImage(state);

  expect(blob.type).toBe('image/jpeg');
  expect(exportedCanvasSizes.at(-1)).toMatchObject({ width: 1440 });
  for (const title of ['1/8 决赛', '1/4 决赛', '半决赛', '决赛']) {
    expect(
      context.fillText.mock.calls.some(([text]) => text === title),
    ).toBe(true);
  }
  expect(
    context.fillText.mock.calls.filter(([text]) =>
      String(text).startsWith('胜者 · '),
    ),
  ).toHaveLength(15);
});

it('makes a 32-entry bracket image taller than a 16-entry bracket image', async () => {
  await buildBracketImage(completedSheriffState());
  const sheriffHeight = exportedCanvasSizes.at(-1)?.height ?? 0;

  await buildBracketImage(completedVandalState());
  const vandalHeight = exportedCanvasSizes.at(-1)?.height ?? 0;

  expect(sheriffHeight).toBeGreaterThan(0);
  expect(vandalHeight).toBeGreaterThan(sheriffHeight);
});

it('still creates the share image with an accessible-looking text fallback when art fails', async () => {
  imageShouldFail = true;

  await expect(buildShareImage(completedSheriffState())).resolves.toBeInstanceOf(Blob);

  expect(context.drawImage).not.toHaveBeenCalled();
  expect(context.fillText).toHaveBeenCalledWith(
    expect.stringContaining('图片暂不可用'),
    expect.any(Number),
    expect.any(Number),
  );
});

it('times out a hanging remote image, cleans it up, and still draws the fallback', async () => {
  vi.useFakeTimers();
  imageShouldHang = true;

  const shareImage = buildShareImage(completedSheriffState());
  await vi.advanceTimersByTimeAsync(SHARE_IMAGE_TIMEOUT_MS - 1);
  expect(context.fillText).not.toHaveBeenCalledWith(
    expect.stringContaining('图片暂不可用'),
    expect.any(Number),
    expect.any(Number),
  );
  await vi.advanceTimersByTimeAsync(1);

  await expect(shareImage).resolves.toBeInstanceOf(Blob);
  expect(mockImages[0].onload).toBeNull();
  expect(mockImages[0].onerror).toBeNull();
  expect(mockImages[0].src).toBe('');
  expect(context.fillText).toHaveBeenCalledWith(
    expect.stringContaining('图片暂不可用'),
    expect.any(Number),
    expect.any(Number),
  );
});

it('throws a clear error if canvas export returns no blob', async () => {
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((callback) => {
    callback(null);
  });

  await expect(buildShareImage(completedSheriffState())).rejects.toThrow(
    '无法导出分享图片',
  );
});

it('downloads through an attached link and revokes its object URL after a short delay', () => {
  vi.useFakeTimers();
  const blob = new Blob(['skin-cup'], { type: 'image/jpeg' });

  downloadShareImage(blob, '冠军.jpg');

  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(anchorClick).toHaveBeenCalledOnce();
  expect(document.body.querySelector('a[download="冠军.jpg"]')).toBeInTheDocument();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();

  vi.advanceTimersByTime(DOWNLOAD_CLEANUP_DELAY_MS);

  expect(document.body.querySelector('a[download="冠军.jpg"]')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:skin-cup');
});

it('uses native file sharing when supported', async () => {
  const nativeShare = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: nativeShare,
  });

  await expect(
    shareShareImage(new Blob(['skin-cup'], { type: 'image/jpeg' }), '冠军.jpg'),
  ).resolves.toBe('shared');
  expect(nativeShare).toHaveBeenCalledWith(
    expect.objectContaining({ files: [expect.any(File)] }),
  );
  expect(anchorClick).not.toHaveBeenCalled();
});

it('falls back to download when native sharing is unsupported or fails', async () => {
  const blob = new Blob(['skin-cup'], { type: 'image/jpeg' });

  await expect(shareShareImage(blob, '冠军.jpg')).resolves.toBe('downloaded');
  expect(anchorClick).toHaveBeenCalledTimes(1);

  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: vi.fn().mockRejectedValue(new Error('share failed')),
  });

  await expect(shareShareImage(blob, '冠军.jpg')).resolves.toBe('downloaded');
  expect(anchorClick).toHaveBeenCalledTimes(2);
});

it('does not force a download when the user cancels native sharing', async () => {
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
  });

  await expect(
    shareShareImage(new Blob(['skin-cup'], { type: 'image/jpeg' }), '冠军.jpg'),
  ).resolves.toBe('cancelled');
  expect(anchorClick).not.toHaveBeenCalled();
});

it('shows the complete podium and gives explicit generation feedback', async () => {
  const state = completedSheriffState();
  const onPlayAgain = vi.fn();
  render(<ChampionScreen state={state} onPlayAgain={onPlayAgain} />);

  expect(screen.getByRole('heading', { name: '冠军诞生' })).toBeInTheDocument();
  expect(screen.getByText(state.champion!.name)).toBeInTheDocument();
  expect(screen.getByText(`亚军 · ${state.runnerUp!.name}`)).toBeInTheDocument();
  expect(screen.getAllByTestId('semifinalist')).toHaveLength(4);
  expect(screen.getAllByTestId('path-step')).toHaveLength(4);
  expect(screen.getByRole('button', { name: '系统分享' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '系统分享' })).toHaveAttribute(
    'aria-describedby',
    'share-status',
  );

  fireEvent.click(screen.getByRole('button', { name: '生成分享图' }));
  expect(screen.getByRole('status')).toHaveTextContent('正在生成分享图');
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('分享图已生成'));
  expect(screen.getByRole('img', { name: '正义冠军分享图预览' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '系统分享' })).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: '再来一场' }));
  expect(onPlayAgain).toHaveBeenCalledOnce();
});

it('invokes native sharing in the generated-image click without an intervening await', async () => {
  let inClick = false;
  const nativeShare = vi.fn(() => {
    if (!inClick) {
      throw new Error('lost transient activation');
    }
    return Promise.resolve();
  });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: nativeShare,
  });
  render(<ChampionScreen state={completedSheriffState()} onPlayAgain={() => {}} />);

  fireEvent.click(screen.getByRole('button', { name: '生成分享图' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '系统分享' })).toBeEnabled());

  inClick = true;
  fireEvent.click(screen.getByRole('button', { name: '系统分享' }));
  inClick = false;

  expect(nativeShare).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已打开系统分享'));
});

it('ignores a hanging generation after a new completed tournament replaces it', async () => {
  vi.useFakeTimers();
  imageShouldHang = true;
  const first = completedSheriffState('first-complete');
  const second = completedSheriffState('second-complete');
  const { rerender } = render(<ChampionScreen state={first} onPlayAgain={() => {}} />);

  fireEvent.click(screen.getByRole('button', { name: '生成分享图' }));
  expect(screen.getByRole('status')).toHaveTextContent('正在生成分享图');
  rerender(<ChampionScreen state={second} onPlayAgain={() => {}} />);

  expect(screen.getByRole('status')).toHaveTextContent('先生成分享图，再使用系统分享');
  expect(screen.getByRole('button', { name: '生成分享图' })).toBeEnabled();
  await vi.advanceTimersByTimeAsync(SHARE_IMAGE_TIMEOUT_MS);
  expect(screen.queryByRole('img', { name: '正义冠军分享图预览' })).not.toBeInTheDocument();
});

it('does not publish a hanging generation result after unmount', async () => {
  vi.useFakeTimers();
  imageShouldHang = true;
  const { unmount } = render(
    <ChampionScreen state={completedSheriffState()} onPlayAgain={() => {}} />,
  );

  fireEvent.click(screen.getByRole('button', { name: '生成分享图' }));
  unmount();
  await vi.advanceTimersByTimeAsync(SHARE_IMAGE_TIMEOUT_MS);

  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('still publishes the current generation result under React StrictMode', async () => {
  render(
    <StrictMode>
      <ChampionScreen state={completedSheriffState()} onPlayAgain={() => {}} />
    </StrictMode>,
  );

  fireEvent.click(screen.getByRole('button', { name: '生成分享图' }));

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('分享图已生成'));
  expect(screen.getByRole('button', { name: '系统分享' })).toBeEnabled();
});

it('replaces a failed champion visual with a labelled placeholder', () => {
  const state = completedSheriffState();
  render(<ChampionScreen state={state} onPlayAgain={() => {}} />);

  fireEvent.error(screen.getByRole('img', { name: `${state.champion!.name} 冠军皮肤图片` }));

  expect(
    screen.getByRole('img', { name: `${state.champion!.name} 冠军图片加载失败` }),
  ).toBeInTheDocument();
});
