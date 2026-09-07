import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChallengeJourneyComponent } from '../components/challenge-journey.component';

/** Marketing home — matches React `app/page.tsx` (hero + evaluation catalog). */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, ChallengeJourneyComponent],
  template: `
    <section class="hero">
      <p class="eyebrow">PropFirm · simulated evaluations</p>
      <h1>Turn your trading skills into income</h1>
      <p class="lead">
        Clear rules. Fast rewards. A FundingPips-style path from challenge to funded account.
      </p>
      <div class="row">
        <a class="btn" href="#journey">Buy Evaluation</a>
        <a class="btn secondary" routerLink="/login">Trader login</a>
      </div>
      <div class="stats">
        <div>
          <strong>3M+</strong>
          <span>Traders (inspired)</span>
        </div>
        <div>
          <strong>$302M+</strong>
          <span>Rewards narrative</span>
        </div>
        <div>
          <strong>195+</strong>
          <span>Countries</span>
        </div>
      </div>
    </section>

    <div id="journey">
      <app-challenge-journey />
    </div>
  `,
})
export class HomePage {}
