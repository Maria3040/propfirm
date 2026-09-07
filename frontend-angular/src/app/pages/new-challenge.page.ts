import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Catalog entry used by “Buy Challenge” CTAs — mirrors React redirect to home. */
@Component({
  selector: 'app-new-challenge-page',
  standalone: true,
  template: `<p class="meta">Opening challenge catalog…</p>`,
})
export class NewChallengePage implements OnInit {
  private readonly router = inject(Router);

  ngOnInit() {
    void this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
