import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-accounts-restore-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="rw-page">
      <div class="rw-heading">
        <h1>Restore archived account</h1>
      </div>
      @if (msg()) {
        <p class="meta">{{ msg() }}</p>
      }
      @if (err()) {
        <p class="err">{{ err() }}</p>
      }
      @if (id()) {
        <p><a [routerLink]="['/accounts', id()]">Open account</a></p>
      } @else {
        <p><a routerLink="/accounts">Back to accounts</a></p>
      }
    </div>
  `,
})
export class AccountsRestorePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly msg = signal('Restoring account…');
  readonly err = signal('');
  readonly id = signal('');

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!token) {
      this.err.set('Missing restore token.');
      this.msg.set('');
      return;
    }
    void this.api
      .request<{ ok?: boolean; id?: string; status?: string }>(
        `/api/challenges/restore?token=${encodeURIComponent(token)}`,
      )
      .then((r) => {
        this.id.set(r.id || '');
        this.msg.set(`Account restored (${r.status || 'ok'}).`);
        if (r.id) {
          window.setTimeout(() => void this.router.navigateByUrl(`/accounts/${r.id}`), 1200);
        }
      })
      .catch((e: unknown) => {
        this.err.set(e instanceof Error ? e.message : 'Restore failed');
        this.msg.set('');
      });
  }
}
