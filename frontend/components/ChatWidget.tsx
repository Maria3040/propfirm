'use client';

import { useEffect, useState } from 'react';

export function ChatWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="chat-widget">
      {open ? (
        <div className="chat-panel" role="dialog" aria-label="Support chat">
          <div className="chat-panel-head">
            <strong>Support</strong>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <div className="chat-panel-body">
            <p>Hi! How can we help?</p>
            <p className="chat-muted">Demo chat — message support@propfirm.local for real help.</p>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="chat-fab"
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M10,18 L6,22 L6,18 L10,18 Z M17,6 C19.7614237,6 22,8.23857625 22,11 C22,13.7614237 19.7614237,16 17,16 L17,16 L7,16 C4.23857625,16 2,13.7614237 2,11 C2,8.23857625 4.23857625,6 7,6 L7,6 Z"
            transform="translate(12.000000, 14.000000) scale(-1, 1) translate(-12.000000, -14.000000)"
          />
        </svg>
      </button>
    </div>
  );
}
