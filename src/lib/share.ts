import type { Skin, TournamentState } from '../domain/types';

export interface ChampionPathStep {
  readonly label: string;
  readonly opponent: Skin;
}

export interface TournamentResult {
  readonly champion: Skin;
  readonly runnerUp: Skin;
  readonly semifinalists: readonly Skin[];
  readonly path: readonly ChampionPathStep[];
}

export type ShareImageOutcome = 'shared' | 'downloaded' | 'cancelled';

function roundLabel(state: TournamentState, roundIndex: number): string {
  if (roundIndex === state.bracket.length - 1) {
    return '决赛';
  }
  if (roundIndex === state.bracket.length - 2) {
    return '半决赛';
  }
  return `${state.config.bracketSize / 2 ** roundIndex} 强`;
}

export function deriveTournamentResult(state: TournamentState): TournamentResult {
  if (state.phase !== 'complete' || !state.champion || !state.runnerUp) {
    throw new Error('赛事尚未完成，无法生成冠军结果');
  }
  const champion = state.champion;
  const runnerUp = state.runnerUp;

  const semifinalRound = state.bracket.at(-2);
  if (!semifinalRound || semifinalRound.length !== 2) {
    throw new Error('赛事对阵数据不完整，无法推导四强');
  }

  const semifinalists = semifinalRound.flatMap((match) => [...match.skins]);
  if (new Set(semifinalists.map((skin) => skin.id)).size !== 4) {
    throw new Error('赛事对阵数据不完整，无法推导四强');
  }

  const path = state.bracket.map((round, roundIndex): ChampionPathStep => {
    const match = round.find(({ skins }) =>
      skins.some((skin) => skin.id === champion.id),
    );
    const opponent = match?.skins.find((skin) => skin.id !== champion.id);

    if (!match || match.winner?.id !== champion.id || !opponent) {
      throw new Error('赛事对阵数据不完整，无法推导冠军路径');
    }

    return { label: roundLabel(state, roundIndex), opponent };
  });

  return {
    champion,
    runnerUp,
    semifinalists,
    path,
  };
}

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function fitImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): void {
  const characters = [...text];
  const lines: string[] = [];
  let current = '';

  for (const character of characters) {
    const candidate = `${current}${character}`;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = character;
      if (lines.length === maxLines) {
        break;
      }
    } else {
      current = candidate;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const displayedLength = lines.join('').length;
  if (displayedLength < characters.length && lines.length > 0) {
    let finalLine = lines.at(-1) ?? '';
    while (finalLine && context.measureText(`${finalLine}…`).width > maxWidth) {
      finalLine = finalLine.slice(0, -1);
    }
    lines[lines.length - 1] = `${finalLine}…`;
  }

  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  if (typeof canvas.toBlob !== 'function') {
    return Promise.reject(new Error('当前浏览器不支持导出分享图片'));
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('无法导出分享图片，请稍后重试'));
        }
      },
      'image/jpeg',
      0.92,
    );
  });
}

export async function buildShareImage(state: TournamentState): Promise<Blob> {
  const result = deriveTournamentResult(state);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持生成分享图片');
  }

  context.fillStyle = '#080a0d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#20363c';
  context.lineWidth = 2;
  for (let offset = -300; offset < 1400; offset += 120) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + 620, 1350);
    context.stroke();
  }

  context.fillStyle = '#ff4655';
  context.fillRect(68, 68, 12, 166);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.font = '900 76px system-ui, sans-serif';
  context.fillText('SKIN CUP', 112, 145);
  context.fillStyle = '#7ee9ee';
  context.font = '700 31px system-ui, sans-serif';
  context.fillText(`${state.config.label} · 全皮肤冠军`, 116, 204);

  context.fillStyle = '#11161b';
  context.fillRect(68, 282, 944, 484);
  const championImage = await loadImage(result.champion.fullRender ?? result.champion.image);
  if (championImage) {
    fitImage(context, championImage, 100, 310, 880, 400);
  } else {
    context.fillStyle = '#172126';
    context.fillRect(100, 310, 880, 400);
    context.fillStyle = '#9db2b5';
    context.font = '600 32px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('冠军图片暂不可用', 540, 520);
  }

  context.textAlign = 'left';
  context.fillStyle = '#ff4655';
  context.font = '800 28px system-ui, sans-serif';
  context.fillText('冠军', 72, 834);
  context.fillStyle = '#f6f3ef';
  context.font = '900 58px system-ui, sans-serif';
  drawWrappedText(context, result.champion.name, 72, 904, 930, 66, 2);
  context.fillStyle = '#7ee9ee';
  context.font = '700 27px system-ui, sans-serif';
  context.fillText(result.champion.tier, 72, 1020);

  context.fillStyle = '#8e9ca0';
  context.font = '700 24px system-ui, sans-serif';
  context.fillText('夺冠之路', 72, 1082);
  context.fillStyle = '#e6e4e0';
  context.font = '600 25px system-ui, sans-serif';
  const pathSummary = result.path
    .map(({ label, opponent }) => `${label} 胜 ${opponent.name}`)
    .join('  ·  ');
  drawWrappedText(context, pathSummary, 72, 1130, 936, 38, 3);

  context.fillStyle = '#ff4655';
  context.fillRect(72, 1280, 936, 4);
  context.fillStyle = '#809195';
  context.font = '500 20px system-ui, sans-serif';
  context.fillText('由 Skin Cup 本地赛事生成', 72, 1320);

  return canvasToJpeg(canvas);
}

export function downloadShareImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export async function shareShareImage(blob: Blob, filename: string): Promise<ShareImageOutcome> {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  const shareData: ShareData = {
    title: 'Skin Cup 冠军',
    text: '这是我选出的皮肤冠军。',
    files: [file],
  };

  if (typeof navigator.share !== 'function' || !navigator.canShare?.(shareData)) {
    downloadShareImage(blob, filename);
    return 'downloaded';
  }

  try {
    await navigator.share(shareData);
    return 'shared';
  } catch (error) {
    if (isAbortError(error)) {
      return 'cancelled';
    }
    downloadShareImage(blob, filename);
    return 'downloaded';
  }
}
