import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-challenge-redirect-page',
  standalone: true,
  template: `<p class="meta">Opening account…</p>`,
})
export class ChallengeRedirectPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.router.navigateByUrl(`/accounts/${id}`, { replaceUrl: true });
    else void this.router.navigateByUrl('/accounts', { replaceUrl: true });
  }
}
