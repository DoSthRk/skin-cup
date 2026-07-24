import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

const CREATOR_NAME = 'DoSthRk';

export function CreatorFooter() {
  const [open, setOpen] = useState(false);
  const pointerInteractionRef = useRef(false);

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setOpen(false);
    }
  }

  function closeWithEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setOpen(false);
  }

  return (
    <footer className="creator-footer">
      <div
        className="creator-profile"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) {
            setOpen(false);
          }
        }}
        onFocusCapture={() => {
          if (!pointerInteractionRef.current) {
            setOpen(true);
          }
        }}
        onBlurCapture={closeWhenFocusLeaves}
        onKeyDown={closeWithEscape}
      >
        <button
          type="button"
          className="creator-trigger"
          aria-label={`查看作者 ${CREATOR_NAME} 的个人信息`}
          aria-expanded={open}
          aria-controls="creator-profile-card"
          onPointerDown={() => {
            pointerInteractionRef.current = true;
          }}
          onPointerCancel={() => {
            pointerInteractionRef.current = false;
          }}
          onClick={() => {
            pointerInteractionRef.current = false;
            setOpen((current) => !current);
          }}
        >
          <img
            src="/creator/clint-avatar.png"
            alt=""
            aria-hidden="true"
          />
          <span>
            <small>MADE BY</small>
            <strong>{CREATOR_NAME}</strong>
          </span>
        </button>

        {open && (
          <section
            id="creator-profile-card"
            className="creator-card"
            role="region"
            aria-label={`作者 ${CREATOR_NAME} 的个人信息`}
          >
            <header className="creator-card__header">
              <img src="/creator/clint-avatar.png" alt={`${CREATOR_NAME} 的头像`} />
              <div>
                <span>CREATOR</span>
                <strong>{CREATOR_NAME}</strong>
                <small>VALORANT-CUP 作者</small>
              </div>
            </header>

            <a
              className="creator-github"
              href="https://github.com/DoSthRk"
              target="_blank"
              rel="noreferrer"
            >
              GitHub · @DoSthRk
            </a>

            <figure className="creator-wechat">
              <img
                src="/creator/clint-wechat.jpg"
                alt={`${CREATOR_NAME} 的微信二维码`}
              />
              <figcaption>微信联系</figcaption>
            </figure>
          </section>
        )}
      </div>
    </footer>
  );
}
