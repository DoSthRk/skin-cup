import type { Skin, TournamentState } from '../domain/types';
import {
  deriveBracketRounds,
  getRoundDescriptor,
} from '../domain/bracket';
import type { BracketRoundResult } from '../domain/bracket';

export interface ChampionPathStep {
  readonly label: string;
  readonly opponent: Skin;
}

export interface TournamentResult {
  readonly champion: Skin;
  readonly runnerUp: Skin;
  readonly thirdPlace: Skin;
  readonly fourthPlace: Skin;
  readonly semifinalists: readonly Skin[];
  readonly path: readonly ChampionPathStep[];
}

export type ShareImageOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface ShareImageMetadata {
  readonly title: string;
  readonly text: string;
}

export const SHARE_IMAGE_TIMEOUT_MS = 8_000;
export const DOWNLOAD_CLEANUP_DELAY_MS = 1_000;
export const BRACKET_IMAGE_WIDTH = 1_440;

const BRACKET_TREE_TOP = 390;
const BRACKET_TREE_FOOTER = 260;
const BRACKET_CARD_WIDTH = 200;
const BRACKET_CARD_HEIGHT = 58;
const BRACKET_SIDE_MARGIN = 34;
const BRACKET_CHAMPION_WIDTH = 340;
const BRACKET_CHAMPION_HEIGHT = 210;

type BracketSide = 'left' | 'right';

interface BracketTreeSide {
  readonly side: BracketSide;
  readonly levels: readonly (readonly Skin[])[];
  readonly xPositions: readonly number[];
  readonly yPositions: readonly (readonly number[])[];
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

  const championSemifinal = semifinalRound.find(
    (match) => match.winner?.id === champion.id,
  );
  const runnerUpSemifinal = semifinalRound.find(
    (match) => match.winner?.id === runnerUp.id,
  );
  const thirdPlace = championSemifinal?.skins.find(
    (skin) => skin.id !== champion.id,
  );
  const fourthPlace = runnerUpSemifinal?.skins.find(
    (skin) => skin.id !== runnerUp.id,
  );
  if (!thirdPlace || !fourthPlace) {
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

    return {
      label: getRoundDescriptor(state.config.bracketSize, roundIndex).title,
      opponent,
    };
  });

  return {
    champion,
    runnerUp,
    thirdPlace,
    fourthPlace,
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
    let settled = false;
    const finish = (result: HTMLImageElement | null, abortLoad = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      if (abortLoad) {
        try {
          image.src = '';
        } catch {
          // Some engines reject clearing an in-flight image; the settled guard still ignores it.
        }
      }
      resolve(result);
    };
    image.crossOrigin = 'anonymous';
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    const timeoutId = window.setTimeout(
      () => finish(null, true),
      SHARE_IMAGE_TIMEOUT_MS,
    );
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

function truncateText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (
    truncated.length > 0 &&
    context.measureText(`${truncated}…`).width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
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

function drawRankingCard(
  context: CanvasRenderingContext2D,
  skin: Skin,
  image: HTMLImageElement | null,
  label: string,
  accent: string,
  x: number,
  y: number,
): void {
  const width = 458;
  const height = 108;

  context.fillStyle = '#11161b';
  context.fillRect(x, y, width, height);
  context.fillStyle = accent;
  context.fillRect(x, y, 6, height);
  context.fillStyle = '#0a0e12';
  context.fillRect(x + 16, y + 14, 112, 80);

  if (image) {
    fitImage(context, image, x + 20, y + 18, 104, 72);
  } else {
    context.fillStyle = '#263238';
    context.font = '700 14px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${label}图片暂不可用`, x + 72, y + 59);
  }

  context.textAlign = 'left';
  context.fillStyle = accent;
  context.font = '800 18px system-ui, sans-serif';
  context.fillText(label, x + 148, y + 31);
  context.fillStyle = '#f6f3ef';
  context.font = '850 23px system-ui, sans-serif';
  context.fillText(
    truncateText(context, skin.name, width - 170),
    x + 148,
    y + 67,
  );
  context.fillStyle = '#87979c';
  context.font = '650 15px system-ui, sans-serif';
  context.fillText(skin.tier, x + 148, y + 92);
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
  const ranking = [
    { label: '冠军', skin: result.champion, accent: '#ff4655' },
    { label: '亚军', skin: result.runnerUp, accent: '#7ee9ee' },
    { label: '季军', skin: result.thirdPlace, accent: '#f4c85a' },
    { label: '殿军', skin: result.fourthPlace, accent: '#9aa8ac' },
  ] as const;
  const rankingImages = await Promise.all(
    ranking.map(({ skin }) => loadImage(skin.fullRender ?? skin.image)),
  );
  const championImage = rankingImages[0];
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
  context.font = '800 25px system-ui, sans-serif';
  context.fillText('冠军', 72, 810);
  context.fillStyle = '#f6f3ef';
  context.font = '900 50px system-ui, sans-serif';
  drawWrappedText(context, result.champion.name, 72, 866, 930, 54, 2);
  context.fillStyle = '#7ee9ee';
  context.font = '700 23px system-ui, sans-serif';
  context.fillText(result.champion.tier, 72, 956);

  context.fillStyle = '#8e9ca0';
  context.font = '800 22px system-ui, sans-serif';
  context.fillText('最终排名', 72, 995);
  ranking.forEach(({ label, skin, accent }, index) => {
    drawRankingCard(
      context,
      skin,
      rankingImages[index],
      label,
      accent,
      index % 2 === 0 ? 68 : 554,
      index < 2 ? 1016 : 1138,
    );
  });

  context.fillStyle = '#ff4655';
  context.fillRect(72, 1282, 936, 4);
  context.fillStyle = '#809195';
  context.font = '500 20px system-ui, sans-serif';
  context.fillText('由 Skin Cup 本地赛事生成', 72, 1322);

  return canvasToJpeg(canvas);
}

function getBracketLeafGap(bracketSize: number): number {
  if (bracketSize <= 16) return 195;
  if (bracketSize <= 32) return 142;
  return 104;
}

function getTierAccent(skin: Skin): string {
  if (skin.tierRank >= 4) return '#f4c85a';
  if (skin.tierRank >= 3) return '#d978ef';
  return '#7ee9ee';
}

function buildBracketTreeSide(
  rounds: readonly BracketRoundResult[],
  side: BracketSide,
  leafGap: number,
): BracketTreeSide {
  const firstRound = rounds[0];
  const halfFirstRound = firstRound.matches.length / 2;
  const firstRoundMatches =
    side === 'left'
      ? firstRound.matches.slice(0, halfFirstRound)
      : firstRound.matches.slice(halfFirstRound);
  const levels: Skin[][] = [
    firstRoundMatches.flatMap((match) => [...match.skins]),
  ];

  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
    const matches = rounds[roundIndex].matches;
    const sideMatchCount = matches.length / 2;
    const sideMatches =
      side === 'left'
        ? matches.slice(0, sideMatchCount)
        : matches.slice(sideMatchCount);
    levels.push(sideMatches.map((match) => match.winner));
  }

  const innerLeftX =
    BRACKET_IMAGE_WIDTH / 2 -
    BRACKET_CHAMPION_WIDTH / 2 -
    BRACKET_CARD_WIDTH -
    30;
  const leftStep =
    levels.length === 1
      ? 0
      : (innerLeftX - BRACKET_SIDE_MARGIN) / (levels.length - 1);
  const leftXPositions = levels.map(
    (_, levelIndex) => BRACKET_SIDE_MARGIN + levelIndex * leftStep,
  );
  const xPositions =
    side === 'left'
      ? leftXPositions
      : leftXPositions.map(
          (leftX) => BRACKET_IMAGE_WIDTH - leftX - BRACKET_CARD_WIDTH,
        );

  const yPositions: number[][] = [
    levels[0].map((_, index) => BRACKET_TREE_TOP + index * leafGap),
  ];
  for (let levelIndex = 1; levelIndex < levels.length; levelIndex += 1) {
    const previousY = yPositions[levelIndex - 1];
    yPositions.push(
      levels[levelIndex].map(
        (_, index) =>
          (previousY[index * 2] + previousY[index * 2 + 1]) / 2,
      ),
    );
  }

  return { side, levels, xPositions, yPositions };
}

function drawBracketConnector(
  context: CanvasRenderingContext2D,
  side: BracketSide,
  childX: number,
  childY: number,
  parentX: number,
  parentY: number,
  highlighted: boolean,
): void {
  const startX =
    side === 'left' ? childX + BRACKET_CARD_WIDTH : childX;
  const endX =
    side === 'left' ? parentX : parentX + BRACKET_CARD_WIDTH;
  const elbowX = (startX + endX) / 2;

  context.beginPath();
  context.moveTo(startX, childY);
  context.lineTo(elbowX, childY);
  context.lineTo(elbowX, parentY);
  context.lineTo(endX, parentY);
  context.strokeStyle = highlighted ? '#ff4655' : '#2a3a40';
  context.lineWidth = highlighted ? 5 : 2;
  context.stroke();
}

function drawChampionConnector(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  highlighted: boolean,
): void {
  const elbowX = (startX + endX) / 2;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(elbowX, startY);
  context.lineTo(elbowX, endY);
  context.lineTo(endX, endY);
  context.strokeStyle = highlighted ? '#ff4655' : '#2a3a40';
  context.lineWidth = highlighted ? 5 : 2;
  context.stroke();
}

function drawBracketCard(
  context: CanvasRenderingContext2D,
  skin: Skin,
  thumbnail: HTMLImageElement | null,
  x: number,
  centerY: number,
  advanced: boolean,
  championPath: boolean,
): void {
  const y = centerY - BRACKET_CARD_HEIGHT / 2;
  context.fillStyle = championPath
    ? '#ff4655'
    : advanced
      ? '#41545a'
      : '#202b30';
  context.fillRect(x, y, BRACKET_CARD_WIDTH, BRACKET_CARD_HEIGHT);
  context.fillStyle = advanced ? '#11191e' : '#0b1014';
  context.fillRect(
    x + 3,
    y + 3,
    BRACKET_CARD_WIDTH - 6,
    BRACKET_CARD_HEIGHT - 6,
  );
  context.fillStyle = getTierAccent(skin);
  context.fillRect(x + 9, y + 9, 40, BRACKET_CARD_HEIGHT - 18);
  context.fillStyle = '#090d10';
  context.fillRect(x + 12, y + 12, 34, BRACKET_CARD_HEIGHT - 24);
  if (thumbnail) {
    fitImage(
      context,
      thumbnail,
      x + 13,
      y + 13,
      32,
      BRACKET_CARD_HEIGHT - 26,
    );
  }

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = advanced ? '#f2f3f1' : '#819095';
  context.font = `${advanced ? '800' : '650'} 18px system-ui, sans-serif`;
  context.fillText(
    truncateText(
      context,
      skin.name.replace(/\s+(狂徒|幻影|正义)$/, ''),
      BRACKET_CARD_WIDTH - 64,
    ),
    x + 56,
    y + 27,
  );
  context.fillStyle = advanced ? '#91a2a6' : '#56666b';
  context.font = '600 12px system-ui, sans-serif';
  context.fillText(
    truncateText(context, skin.tier, BRACKET_CARD_WIDTH - 64),
    x + 56,
    y + 45,
  );
}

function drawBracketTreeSide(
  context: CanvasRenderingContext2D,
  tree: BracketTreeSide,
  championId: string,
  thumbnails: ReadonlyMap<string, HTMLImageElement | null>,
): void {
  for (let levelIndex = 1; levelIndex < tree.levels.length; levelIndex += 1) {
    const childLevel = tree.levels[levelIndex - 1];
    const parentLevel = tree.levels[levelIndex];
    for (let parentIndex = 0; parentIndex < parentLevel.length; parentIndex += 1) {
      for (const childIndex of [parentIndex * 2, parentIndex * 2 + 1]) {
        drawBracketConnector(
          context,
          tree.side,
          tree.xPositions[levelIndex - 1],
          tree.yPositions[levelIndex - 1][childIndex],
          tree.xPositions[levelIndex],
          tree.yPositions[levelIndex][parentIndex],
          childLevel[childIndex].id === championId,
        );
      }
    }
  }

  tree.levels.forEach((level, levelIndex) => {
    level.forEach((skin, index) => {
      const nextLevel = tree.levels[levelIndex + 1];
      const advanced =
        !nextLevel ||
        nextLevel[Math.floor(index / 2)]?.id === skin.id;
      drawBracketCard(
        context,
        skin,
        thumbnails.get(skin.id) ?? null,
        tree.xPositions[levelIndex],
        tree.yPositions[levelIndex][index],
        advanced,
        skin.id === championId,
      );
    });
  });
}

export async function buildBracketImage(
  state: TournamentState,
): Promise<Blob> {
  const rounds = deriveBracketRounds(state);
  const champion = state.champion;
  if (!champion) {
    throw new Error('赛事尚未完成，无法生成完整晋级图');
  }
  const leafGap = getBracketLeafGap(state.config.bracketSize);
  const leavesPerSide = state.config.bracketSize / 2;
  const canvas = document.createElement('canvas');
  canvas.width = BRACKET_IMAGE_WIDTH;
  canvas.height =
    BRACKET_TREE_TOP +
    (leavesPerSide - 1) * leafGap +
    BRACKET_TREE_FOOTER;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持生成完整晋级图');
  }
  const leftTree = buildBracketTreeSide(rounds, 'left', leafGap);
  const rightTree = buildBracketTreeSide(rounds, 'right', leafGap);
  const entrants = rounds[0].matches.flatMap((match) => [...match.skins]);
  const [championImage, thumbnailEntries] = await Promise.all([
    loadImage(champion.fullRender ?? champion.image),
    Promise.all(
      entrants.map(
        async (skin) =>
          [skin.id, await loadImage(skin.image)] as const,
      ),
    ),
  ]);
  const thumbnails = new Map(thumbnailEntries);
  const championCenterY =
    (leftTree.yPositions[0][0] + leftTree.yPositions[0].at(-1)!) / 2;
  const championX =
    (BRACKET_IMAGE_WIDTH - BRACKET_CHAMPION_WIDTH) / 2;
  const championY = championCenterY - BRACKET_CHAMPION_HEIGHT / 2;

  context.fillStyle = '#080a0d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#100b12';
  context.fillRect(0, 0, canvas.width / 2, canvas.height);
  context.fillStyle = '#071217';
  context.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  context.fillStyle = 'rgba(255, 70, 85, 0.035)';
  context.fillRect(0, 0, 420, canvas.height);
  context.fillStyle = 'rgba(126, 233, 238, 0.025)';
  context.fillRect(canvas.width - 420, 0, 420, canvas.height);
  context.strokeStyle = '#18282e';
  context.lineWidth = 2;
  for (let offset = -canvas.height; offset < canvas.width; offset += 180) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + canvas.height, canvas.height);
    context.stroke();
  }

  context.fillStyle = '#ff4655';
  context.fillRect(canvas.width / 2 - 118, 54, 236, 5);
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.font = '950 66px system-ui, sans-serif';
  context.fillStyle = '#f6f3ef';
  context.fillText('SKIN CUP', canvas.width / 2, 124);
  context.font = '850 38px system-ui, sans-serif';
  context.fillStyle = '#7ee9ee';
  context.fillText(
    `${state.config.label} · 皮肤淘汰赛`,
    canvas.width / 2,
    181,
  );
  context.font = '650 22px system-ui, sans-serif';
  context.fillStyle = '#9eacaf';
  context.fillText(
    `${state.config.bracketSize} 强完整晋级图 · ${
      state.config.bracketSize - 1
    } 场对决`,
    canvas.width / 2,
    222,
  );

  context.font = '800 16px system-ui, sans-serif';
  context.fillStyle = '#7f9297';
  rounds.forEach((round, roundIndex) => {
    const leftX =
      leftTree.xPositions[roundIndex] + BRACKET_CARD_WIDTH / 2;
    const rightX =
      rightTree.xPositions[roundIndex] + BRACKET_CARD_WIDTH / 2;
    context.fillText(round.descriptor.title, leftX, BRACKET_TREE_TOP - 62);
    context.fillText(round.descriptor.title, rightX, BRACKET_TREE_TOP - 62);
  });

  const leftFinalist = leftTree.levels.at(-1)![0];
  const rightFinalist = rightTree.levels.at(-1)![0];
  const leftFinalistX = leftTree.xPositions.at(-1)!;
  const rightFinalistX = rightTree.xPositions.at(-1)!;
  const leftFinalistY = leftTree.yPositions.at(-1)![0];
  const rightFinalistY = rightTree.yPositions.at(-1)![0];
  drawChampionConnector(
    context,
    leftFinalistX + BRACKET_CARD_WIDTH,
    leftFinalistY,
    championX,
    championCenterY,
    leftFinalist.id === champion.id,
  );
  drawChampionConnector(
    context,
    rightFinalistX,
    rightFinalistY,
    championX + BRACKET_CHAMPION_WIDTH,
    championCenterY,
    rightFinalist.id === champion.id,
  );

  drawBracketTreeSide(context, leftTree, champion.id, thumbnails);
  drawBracketTreeSide(context, rightTree, champion.id, thumbnails);

  context.fillStyle = '#ff4655';
  context.fillRect(
    championX - 5,
    championY - 5,
    BRACKET_CHAMPION_WIDTH + 10,
    BRACKET_CHAMPION_HEIGHT + 10,
  );
  context.fillStyle = '#0e151a';
  context.fillRect(
    championX,
    championY,
    BRACKET_CHAMPION_WIDTH,
    BRACKET_CHAMPION_HEIGHT,
  );
  if (championImage) {
    fitImage(
      context,
      championImage,
      championX + 12,
      championY + 12,
      BRACKET_CHAMPION_WIDTH - 24,
      BRACKET_CHAMPION_HEIGHT - 24,
    );
  } else {
    context.fillStyle = '#172126';
    context.fillRect(
      championX + 12,
      championY + 12,
      BRACKET_CHAMPION_WIDTH - 24,
      BRACKET_CHAMPION_HEIGHT - 24,
    );
    context.fillStyle = '#9db2b5';
    context.font = '650 21px system-ui, sans-serif';
    context.fillText(
      '冠军图片暂不可用',
      BRACKET_IMAGE_WIDTH / 2,
      championCenterY + 7,
    );
  }

  context.fillStyle = '#ff4655';
  context.fillRect(
    BRACKET_IMAGE_WIDTH / 2 - 132,
    championY + BRACKET_CHAMPION_HEIGHT + 24,
    264,
    46,
  );
  context.fillStyle = '#ffffff';
  context.font = '900 20px system-ui, sans-serif';
  context.fillText(
    '冠军 · CHAMPION',
    BRACKET_IMAGE_WIDTH / 2,
    championY + BRACKET_CHAMPION_HEIGHT + 55,
  );
  context.fillStyle = '#f6f3ef';
  context.font = '900 30px system-ui, sans-serif';
  context.fillText(
    truncateText(context, champion.name, 440),
    BRACKET_IMAGE_WIDTH / 2,
    championY + BRACKET_CHAMPION_HEIGHT + 112,
  );
  context.fillStyle = '#7ee9ee';
  context.font = '700 17px system-ui, sans-serif';
  context.fillText(
    `${champion.tier} · ${state.config.label} 皮肤之巅`,
    BRACKET_IMAGE_WIDTH / 2,
    championY + BRACKET_CHAMPION_HEIGHT + 145,
  );

  context.fillStyle = '#ff4655';
  context.fillRect(72, canvas.height - 82, canvas.width - 144, 4);
  context.textAlign = 'left';
  context.font = '500 20px system-ui, sans-serif';
  context.fillStyle = '#809195';
  context.fillText(
    `由 Skin Cup 生成 · valorant-cup.dosthrk.com`,
    72,
    canvas.height - 40,
  );

  return canvasToJpeg(canvas);
}

export function downloadShareImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.dataset.skinCupDownload = 'true';
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, DOWNLOAD_CLEANUP_DELAY_MS);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export async function shareShareImage(
  blob: Blob,
  filename: string,
  metadata: ShareImageMetadata = {
    title: 'Skin Cup 冠军',
    text: '这是我选出的皮肤冠军。',
  },
): Promise<ShareImageOutcome> {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  const shareData: ShareData = {
    title: metadata.title,
    text: metadata.text,
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
