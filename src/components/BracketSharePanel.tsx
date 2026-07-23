import { useEffect, useRef, useState } from 'react';
import type { TournamentState } from '../domain/types';
import {
  buildBracketImage,
  downloadShareImage,
  shareShareImage,
} from '../lib/share';

interface BracketSharePanelProps {
  readonly state: TournamentState;
}

type GenerationState = 'idle' | 'generating' | 'success' | 'error';

export function BracketSharePanel({ state }: BracketSharePanelProps) {
  const [bracketBlob, setBracketBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generationState, setGenerationState] =
    useState<GenerationState>('generating');
  const [message, setMessage] = useState('正在生成完整晋级图…');
  const mountedRef = useRef(true);
  const requestTokenRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const filename = `Skin-Cup-${state.config.label}-完整晋级图.jpg`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestTokenRef.current += 1;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void generate();
  }, []);

  async function generate(): Promise<Blob | null> {
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    setGenerationState('generating');
    setMessage('正在生成完整晋级图…');

    try {
      const blob = await buildBracketImage(state);
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return null;
      }

      const nextPreviewUrl = URL.createObjectURL(blob);
      const previousPreviewUrl = previewUrlRef.current;
      previewUrlRef.current = nextPreviewUrl;
      setBracketBlob(blob);
      setPreviewUrl(nextPreviewUrl);
      setGenerationState('success');
      setMessage('晋级图已生成');
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }
      return blob;
    } catch (error) {
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return null;
      }
      setGenerationState('error');
      setMessage(
        error instanceof Error ? error.message : '晋级图生成失败，请稍后重试',
      );
      return null;
    }
  }

  async function download(): Promise<void> {
    const blob = bracketBlob ?? (await generate());
    if (!blob) return;
    downloadShareImage(blob, filename);
    setMessage('晋级图已下载');
  }

  function share(): void {
    if (!bracketBlob) return;
    const requestToken = requestTokenRef.current;
    void shareShareImage(bracketBlob, filename, {
      title: 'Skin Cup 完整晋级图',
      text: '这是我的完整皮肤淘汰赛晋级图。',
    }).then((outcome) => {
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return;
      }
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
    <section
      className="share-panel bracket-share-panel"
      aria-labelledby="bracket-share-heading"
    >
      <div>
        <span className="eyebrow">FULL BRACKET</span>
        <h2 id="bracket-share-heading">下载完整淘汰赛晋级图</h2>
        <p className="bracket-share-description">
          包含淘汰赛每一轮、每一场对决和胜者
        </p>
      </div>
      {previewUrl ? (
        <img
          className="share-preview bracket-share-preview"
          src={previewUrl}
          alt={`${state.config.label}完整晋级图预览`}
        />
      ) : (
        <div
          className="share-preview share-preview--empty bracket-share-preview"
          aria-hidden="true"
        >
          1440 × 自动高度
        </div>
      )}
      <p
        id="bracket-share-status"
        className={`share-status share-status--${generationState}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
      <div className="share-actions bracket-share-actions">
        <button
          type="button"
          onClick={() => void download()}
          disabled={generationState === 'generating'}
        >
          下载晋级图
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!bracketBlob || generationState === 'generating'}
          aria-describedby="bracket-share-status"
        >
          分享晋级图
        </button>
      </div>
    </section>
  );
}
