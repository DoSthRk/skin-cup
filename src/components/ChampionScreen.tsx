import { useEffect, useMemo, useRef, useState } from 'react';
import type { TournamentState } from '../domain/types';
import {
  buildShareImage,
  deriveTournamentResult,
  downloadShareImage,
  shareShareImage,
} from '../lib/share';

interface ChampionScreenProps {
  readonly state: TournamentState;
  readonly onPlayAgain: () => void;
}

type GenerationState = 'idle' | 'generating' | 'success' | 'error';

export function ChampionScreen({ state, onPlayAgain }: ChampionScreenProps) {
  const result = useMemo(() => deriveTournamentResult(state), [state]);
  const [championImageFailed, setChampionImageFailed] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [message, setMessage] = useState('先生成分享图，再使用系统分享');
  const mountedRef = useRef(true);
  const requestTokenRef = useRef(0);
  const championImage = result.champion.fullRender ?? result.champion.image;
  const filename = `Skin-Cup-${state.config.label}-${result.champion.name}.jpg`;
  const resultKey = `${state.weapon}:${state.seed}:${result.champion.id}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    requestTokenRef.current += 1;
    setShareBlob(null);
    setGenerationState('idle');
    setMessage('先生成分享图，再使用系统分享');
  }, [resultKey]);

  useEffect(() => {
    setChampionImageFailed(false);
  }, [result.champion.id]);

  useEffect(() => {
    if (!shareBlob) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(shareBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shareBlob]);

  async function generate(): Promise<Blob | null> {
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    setGenerationState('generating');
    setMessage('正在生成分享图…');
    try {
      const blob = await buildShareImage(state);
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return null;
      }
      setShareBlob(blob);
      setGenerationState('success');
      setMessage('分享图已生成');
      return blob;
    } catch (error) {
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return null;
      }
      setGenerationState('error');
      setMessage(error instanceof Error ? error.message : '分享图生成失败，请稍后重试');
      return null;
    }
  }

  async function ensureShareBlob(): Promise<Blob | null> {
    return shareBlob ?? generate();
  }

  async function download(): Promise<void> {
    const blob = await ensureShareBlob();
    if (!blob) return;
    downloadShareImage(blob, filename);
    setMessage('分享图已下载');
  }

  function share(): void {
    if (!shareBlob) return;
    const requestToken = requestTokenRef.current;
    void shareShareImage(shareBlob, filename).then((outcome) => {
      if (!mountedRef.current || requestToken !== requestTokenRef.current) return;
      setMessage(
        outcome === 'shared'
          ? '已打开系统分享'
          : outcome === 'cancelled'
            ? '已取消系统分享'
            : '当前设备无法分享，已改为下载',
      );
    });
  }

  return (
    <section className="stage champion-screen" aria-labelledby="complete-heading">
      <header className="champion-screen__heading">
        <span className="eyebrow">TOURNAMENT COMPLETE</span>
        <h1 id="complete-heading">冠军诞生</h1>
        <p>{state.config.label} · {state.config.expectedCount} 款全部参赛</p>
      </header>

      <article className="champion-hero">
        <div className="champion-hero__visual">
          {championImage && !championImageFailed ? (
            <img
              src={championImage}
              alt={`${result.champion.name} 冠军皮肤图片`}
              onError={() => setChampionImageFailed(true)}
            />
          ) : (
            <div
              className="champion-hero__placeholder"
              role="img"
              aria-label={`${result.champion.name} ${championImageFailed ? '冠军图片加载失败' : '暂无冠军图片'}`}
            >
              冠军图片暂不可用
            </div>
          )}
        </div>
        <div className="champion-hero__copy">
          <span className="champion-kicker">CHAMPION</span>
          <h2>{result.champion.name}</h2>
          <p className="champion-tier">{result.champion.tier}</p>
          <p className="runner-up">亚军 · {result.runnerUp.name}</p>
        </div>
      </article>

      <div className="result-grid">
        <section className="result-panel" aria-labelledby="semifinalists-heading">
          <h2 id="semifinalists-heading">四强阵容</h2>
          <ol className="semifinalist-list">
            {result.semifinalists.map((skin, index) => (
              <li key={skin.id} data-testid="semifinalist">
                <span>{skin.id === result.champion.id ? '冠军' : skin.id === result.runnerUp.id ? '亚军' : '四强'}</span>
                <strong>{index + 1}. {skin.name}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="result-panel" aria-labelledby="path-heading">
          <h2 id="path-heading">完整晋级路径</h2>
          <ol className="champion-path">
            {result.path.map((step) => (
              <li key={`${step.label}-${step.opponent.id}`} data-testid="path-step">
                <span>{step.label}</span>
                <strong>胜 {step.opponent.name}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="share-panel" aria-labelledby="share-heading">
        <div>
          <span className="eyebrow">SHARE CARD</span>
          <h2 id="share-heading">保存你的冠军结果</h2>
        </div>
        {previewUrl ? (
          <img
            className="share-preview"
            src={previewUrl}
            alt={`${state.config.label}冠军分享图预览`}
          />
        ) : (
          <div className="share-preview share-preview--empty" aria-hidden="true">
            1080 × 1350
          </div>
        )}
        <p
          id="share-status"
          className={`share-status share-status--${generationState}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
        <div className="share-actions">
          <button type="button" onClick={() => void generate()} disabled={generationState === 'generating'}>
            {generationState === 'generating' ? '生成中…' : '生成分享图'}
          </button>
          <button type="button" onClick={() => void download()} disabled={generationState === 'generating'}>
            下载图片
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!shareBlob || generationState === 'generating'}
            aria-describedby="share-status"
          >
            系统分享
          </button>
        </div>
      </section>

      <button type="button" className="primary-action play-again" onClick={onPlayAgain}>
        再来一场
      </button>
    </section>
  );
}
