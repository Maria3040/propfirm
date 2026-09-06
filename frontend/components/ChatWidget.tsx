'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';

type Msg = { id: string; role: 'bot' | 'user'; text: string };

const WELCOME: Msg = {
  id: 'welcome',
  role: 'bot',
  text: 'Hi! PropFirm support here. Ask about challenges, credentials emails, breaches, or payouts.',
};

function replyTo(input: string): string {
  const q = input.toLowerCase();
  if (/(credential|login|password|invoice|email|mail)/.test(q)) {
    return 'After you confirm payment we email invoice + MT5 credentials to your account address. Check Mailpit at http://localhost:8026 in this demo.';
  }
  if (/(breach|fail|daily|drawdown|risk)/.test(q)) {
    return 'If you hit Daily Loss or Max Drawdown, the account locks immediately and you get an "Account breached" email with the rule and reason.';
  }
  if (/(payout|withdraw|wallet)/.test(q)) {
    return 'Funded traders request payouts under /payouts. Admin approval triggers a "Payout approved" email.';
  }
  if (/(challenge|buy|purchase|order)/.test(q)) {
    return 'Pick a product on the catalog, checkout, then confirm payment. You will land on your challenge page with platform login details.';
  }
  if (/(hello|hi|hey)/.test(q)) {
    return 'Hello! How can we help with your PropFirm account today?';
  }
  return 'Thanks - a specialist would follow up at support@propfirm.local. In this demo try keywords: credentials, breach, payout, challenge.';
}

export function ChatWidget() {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setVisible(true));
      const focus = window.setTimeout(() => inputRef.current?.focus(), 280);
      return () => {
        cancelAnimationFrame(t);
        window.clearTimeout(focus);
      };
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  if (!mounted) return null;

  function close() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 320);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text };
    setMsgs((m) => [...m, userMsg]);
    setDraft('');
    window.setTimeout(() => {
      setMsgs((m) => [
        ...m,
        { id: `b-${Date.now()}`, role: 'bot', text: replyTo(text) },
      ]);
    }, 450);
  }

  return (
    <div className="chat-widget">
      {open ? (
        <div
          className={`chat-panel${visible ? ' is-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          title="Messaging window"
        >
          <div className="chat-panel-head">
            <div className="chat-panel-brand">
              <span className="chat-avatar" aria-hidden>
                PF
              </span>
              <div>
                <strong id={titleId}>PropFirm Support</strong>
                <span className="chat-online">Online · demo bot</span>
              </div>
            </div>
            <button type="button" className="chat-close" aria-label="Close chat" onClick={close}>
              ×
            </button>
          </div>
          <div className="chat-panel-body" ref={listRef}>
            {msgs.map((m) => (
              <div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              aria-label="Message"
              autoComplete="off"
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className={`chat-fab${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M10,18 L6,22 L6,18 L10,18 Z M17,6 C19.7614237,6 22,8.23857625 22,11 C22,13.7614237 19.7614237,16 17,16 L17,16 L7,16 C4.23857625,16 2,13.7614237 2,11 C2,8.23857625 4.23857625,6 7,6 L7,6 Z"
              transform="translate(12.000000, 14.000000) scale(-1, 1) translate(-12.000000, -14.000000)"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
