import { useEffect } from 'react';

interface ShareImagePreviewProps {
  readonly filename: string;
  readonly imageLabel: string;
  readonly mode: 'save' | 'share';
  readonly onClose: () => void;
  readonly src: string;
}

export function ShareImagePreview({
  filename,
  imageLabel,
  mode,
  onClose,
  src,
}: ShareImagePreviewProps) {
  const title = mode === 'share' ? `分享${imageLabel}` : `保存${imageLabel}`;
  const instruction =
    mode === 'share'
      ? '长按图片发送给朋友，或点击微信右上角分享'
      : '长按图片，选择“保存图片”即可存入手机相册';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [onClose]);

  return (
    <div
      className="share-image-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="share-image-overlay__sheet">
        <header>
          <div>
            <span className="eyebrow">ORIGINAL IMAGE</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭原图">
            ×
          </button>
        </header>
        <p className="share-image-overlay__instruction">{instruction}</p>
        <img
          src={src}
          alt={`可长按${mode === 'share' ? '分享' : '保存'}的${imageLabel}原图`}
        />
        <p className="share-image-overlay__filename">{filename}</p>
      </div>
    </div>
  );
}
