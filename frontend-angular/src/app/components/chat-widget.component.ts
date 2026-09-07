import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chat-widget">
      @if (open()) {
        <div
          class="chat-panel"
          [class.is-open]="visible()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-title"
          title="Messaging window"
        >
          <div class="chat-panel-head">
            <div class="chat-panel-brand">
              <span class="chat-avatar" aria-hidden="true">PF</span>
              <div>
                <strong id="chat-title">PropFirm Support</strong>
                <span class="chat-online">Online · demo bot</span>
              </div>
            </div>
            <button type="button" class="chat-close" aria-label="Close chat" (click)="close()">×</button>
          </div>
          <div class="chat-panel-body" #listRef>
            @for (m of msgs(); track m.id) {
              <div class="chat-bubble" [class]="'chat-bubble chat-bubble-' + m.role">
                <p>{{ m.text }}</p>
              </div>
            }
          </div>
          <form class="chat-composer" (ngSubmit)="onSubmit()">
            <input
              type="text"
              [(ngModel)]="draft"
              name="draft"
              placeholder="Write a message…"
              aria-label="Message"
              autocomplete="off"
            />
            <button type="submit" aria-label="Send message" [disabled]="!draft.trim()">Send</button>
          </form>
        </div>
      }
      <button
        type="button"
        class="chat-fab"
        [class.is-open]="open()"
        [attr.aria-label]="open() ? 'Close support chat' : 'Open support chat'"
        [attr.aria-expanded]="open()"
        (click)="open() ? close() : openChat()"
      >
        @if (open()) {
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z"
            />
          </svg>
        } @else {
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M10,18 L6,22 L6,18 L10,18 Z M17,6 C19.7614237,6 22,8.23857625 22,11 C22,13.7614237 19.7614237,16 17,16 L17,16 L7,16 C4.23857625,16 2,13.7614237 2,11 C2,8.23857625 4.23857625,6 7,6 L7,6 Z"
              transform="translate(12.000000, 14.000000) scale(-1, 1) translate(-12.000000, -14.000000)"
            />
          </svg>
        }
      </button>
    </div>
  `,
})
export class ChatWidgetComponent {
  readonly open = signal(false);
  readonly visible = signal(false);
  readonly msgs = signal<Msg[]>([WELCOME]);
  draft = '';
  private readonly listRef = viewChild<ElementRef<HTMLDivElement>>('listRef');
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  openChat() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.open.set(true);
    requestAnimationFrame(() => this.visible.set(true));
  }

  close() {
    this.visible.set(false);
    this.closeTimer = setTimeout(() => this.open.set(false), 320);
  }

  onSubmit() {
    const text = this.draft.trim();
    if (!text) return;
    this.msgs.update((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text }]);
    this.draft = '';
    setTimeout(() => {
      this.msgs.update((m) => [...m, { id: `b-${Date.now()}`, role: 'bot', text: replyTo(text) }]);
      const el = this.listRef()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 450);
    const el = this.listRef()?.nativeElement;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }
}
