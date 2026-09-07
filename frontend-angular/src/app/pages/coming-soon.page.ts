import { Component, inject, OnInit, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coming-soon-page',
  standalone: true,
  template: `
    <div class="stub-page" style="padding: 2rem">
      <h1>{{ heading }}</h1>
      <p class="meta">This page is wired in the Angular shell and will be ported next.</p>
    </div>
  `,
})
export class ComingSoonPage implements OnInit {
  /** Bound from route data via withComponentInputBinding. */
  readonly title = input<string>('Coming soon');
  private readonly route = inject(ActivatedRoute);
  heading = 'Coming soon';

  ngOnInit() {
    this.heading =
      this.title() ||
      (this.route.snapshot.data['title'] as string | undefined) ||
      'Coming soon';
  }
}
